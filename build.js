const fs = require("fs")
const exec = require("child_process").exec
const zipper = require("zip-local")

const ignores = fs.readFileSync(".buildignore").toString().split("\n")

async function write(writeStream, text) {
  return new Promise((res, rej) => {
    writeStream.write(text, (err, data) => {
      if (err) rej(err)
      else res(data)
    })
  })
}

async function execute(command) {
  return new Promise((res, rej) => {
    exec(command, (err, stdout, stderr) => {
      if (err) rej(err)
      else if (stderr) rej(stderr)
      else res(stdout)
    })
  })
}

async function zip(filePath, outPath) {
  return new Promise((res, rej) => {
    zipper.zip(filePath, (err, zipped) => {
      if (err) rej(err)
      else {
        zipped.compress()
        zipped.save(outPath, (err) => {
          if (err) rej(err)
          else res()
        })
      }
    })
  })
}

async function buildFilesInDirectory(directory, path, projectName) {
  var functions = []
  var items = fs.readdirSync(directory, {withFileTypes: true})
  for (var index = 0; index < items.length; index++) {
    var item = items[index]
    if (ignores.includes(`${path}${item.name}`)) continue
    if (item.isFile() && item.name.endsWith(".ts")) {
      var name = item.name.slice(0, item.name.length - 3)
      process.stdout.write(`Compiling function ${name}...`)
      await execute(`tsc ${path}${item.name} --outDir build/${path}`)
      await zip(`build/${path}${name}.js`, `build/${path}${name}.zip`)
      var module = require(`./build/${path}${name}.js`)
      if (!module.handler)
        throw new Error(`Module ${name} doesn't export its handler function`)
      functions.push({
        name: `${projectName}_${name}`,
        path: `${path}${name}.zip`,
        handler: `${name}.handler`,
        timeout: module.timeout,
        memorySize: module.memorySize,
      })
      console.info(`Done`)
    } else if (item.isDirectory()) {
      functions.push(
        ...(await buildFilesInDirectory(
          `${item.parentPath}/${item.name}`,
          `${path}${item.name}/`,
          projectName
        ))
      )
    }
  }
  return functions
}

async function buildAndWriteDeployFile() {
  if (fs.existsSync("build")) fs.rmSync("build", {recursive: true})
  console.info(`Scanning and compiling functions:`)
  const rawConfig = fs.readFileSync("buildconfig.json")
  const {defaultTimeout, defaultMemorySize, projectName} = JSON.parse(rawConfig)
  var functions = await buildFilesInDirectory(process.cwd(), "", projectName)
  console.info(
    `${functions.length} functions compiled successfully!\nCreating deploy.js file...`
  )
  var writer = fs.createWriteStream("build/deploy.js")
  await write(writer, `var exec = require("child_process").exec\n\n`)
  await write(
    writer,
    `async function execute(command) {
  return new Promise((res, rej) => {
    exec(command, (err, stdout, stderr) => {
      if (err) rej(err)
      else if (stderr) rej(stderr)
      else res(stdout)
    })
  })
}\n\n`
  )
  await write(
    writer,
    `async function deploy() {
  const buildFunctions = ['${functions.map((item) => item.name).join("','")}']
  const currFunctionsRaw = JSON.parse(await execute('aws lambda list-functions'))
  const currFunctions = currFunctionsRaw.Functions.map(item => item.FunctionName)
  const toExclude = currFunctions.filter(funcName => !buildFunctions.includes(funcName))\n
  for(var index = 0; index < toExclude.length; index++) {
    process.stdout.write(\`Deleting function \${toExclude[index]}...\`)
    await execute(\`aws lambda delete-function --function-name=\${toExclude[index]}\`)
    console.info('Done')
  }\n`
  )
  for (var index = 0; index < functions.length; index++) {
    const item = functions[index]
    await write(
      writer,
      `\n  try {
    process.stdout.write('[${index + 1}/${
        functions.length
      }]Deploying function ${item.name}...')
    await execute('aws lambda get-function --function-name=${item.name}')
    await execute('aws lambda update-function-code --function-name=${
      item.name
    } --zip-file=fileb://build/${
        item.path /*WAIT FOR THE UPDATE TO FINISH TO UPDATE THE CONFIG*/
      }')
    let waiting = true
    while(waiting) {
      waiting = (await execute('aws lambda get-function-configuration --function-name=${
        item.name
      }')).State === 'Pending'
    }
    await execute('aws lambda update-function-configuration --function-name=${
      item.name
    } --timeout=${item.timeout || defaultTimeout || 60} --memory-size=${
        item.memorySize || defaultMemorySize || 128
      }')
  } catch (err) {
    if (!err.message.includes('Function not found'))
      console.error({err})
    await execute('aws lambda create-function --function-name=${
      item.name
    } --timeout=${item.timeout || defaultTimeout || 60} --memory-size=${
        item.memorySize || defaultMemorySize || 128
      } --zip-file=fileb://build/${item.path} --role=${
        process.env.AWS_ROLE
      } --runtime=nodejs20.x --handler=${item.handler}')
  } finally {
    console.info('Done')
  }\n`
    )
  }
  await write(writer, `}\n\ndeploy()`)
  writer.close()
}

buildAndWriteDeployFile()
