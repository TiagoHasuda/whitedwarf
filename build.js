const fs = require("fs")
const exec = require("child_process").exec
const zipper = require("zip-local")
const path = require("path")

const ignores = fs
  .readFileSync(".buildignore")
  .toString()
  .split("\n")
  .map((item) => item.replace("\r", ""))

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
      await execute(`tsc ${directory}/${item.name} --outDir build/${path}`)
      await zip(`build/${path}${name}.js`, `build/${path}${name}.zip`)
      var module = require(`./build/${path}${name}.js`)
      if (!module.handler)
        throw new Error(`Module ${name} doesn't export its handler function`)
      if (!module.httpMethod)
        throw new Error(`Module ${name} doesn't export its HTTP method`)
      const apiPath = path.split("/")
      apiPath.pop()
      apiPath.push(name)
      functions.push({
        name: `${projectName}_${path.replaceAll("/", "_")}${name}`,
        path: `${path}${name}.zip`,
        handler: `${name}.handler`,
        apiPath,
        timeout: module.timeout,
        memorySize: module.memorySize,
        httpMethod: module.httpMethod,
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
  const {defaultTimeout, defaultMemorySize, projectName, rootFolder} =
    JSON.parse(rawConfig)
  var functions = await buildFilesInDirectory(
    path.join(process.cwd(), rootFolder),
    "",
    projectName
  )
  console.info(
    `${functions.length} functions compiled successfully!\nCreating deployment files...`
  )
  const jsonOut = {}
  jsonOut.functionNames = functions.map((item) => item.name)
  jsonOut.functions = functions.map((func) => ({
    ...func,
    timeout: func.timeout || defaultTimeout || 60,
    memorySize: func.memorySize || defaultMemorySize || 128,
  }))
  const jsonWriter = fs.createWriteStream("build/deployParams.json")
  await write(jsonWriter, JSON.stringify(jsonOut))
  jsonWriter.close()
  var writer = fs.createWriteStream("build/deploy.js")
  await write(
    writer,
    `const fs = require("fs")\nvar exec = require("child_process").exec\n\n`
  )
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
    `async function deployFunction(func) {
  let exists = false
  try {
    await execute(\`aws lambda get-function --function-name=\${func.name}\`)
    exists = true
  } catch {}
  let lambda
  if (!exists) {
    lambda = JSON.parse(await execute(\`aws lambda create-function --function-name=\${func.name} --timeout=\${func.timeout || defaultTimeout} --memory-size=\${func.memorySize || defaultMemorySize || 128} --zip-file=fileb://build/\${func.path} --role=${process.env.AWS_ROLE} --runtime=nodejs20.x --handler=\${func.handler}\`))
  } else {
    lambda = JSON.parse(await execute(\`aws lambda update-function-code --function-name=\${func.name} --zip-file=fileb://build/\${func.path}\`))
    let waiting = true
    while(waiting) {
      waiting = (await execute(\`aws lambda get-function-configuration --function-name=\${func.name}\`)).State === 'Pending'
    }
    await execute(\`aws lambda update-function-configuration --function-name=\${func.name} --timeout=\${func.timeout || defaultTimeout} --memory-size=\${func.memorySize || defaultMemorySize}\`)
  }
  const resources = JSON.parse(await execute(\`aws apigateway get-resources --rest-api-id=${process.env.AWS_REST_API_ID}\`)).items
  let currPath = resources.find(res => res.path === "/")
  let currPathStr = ""
  for(var index = 0; index < func.apiPath.length; index++) {
    currPathStr += "/" + func.apiPath[index]
    const path = resources.find(res => res.path === currPathStr)
    if (!path) {
      currPath = JSON.parse(await execute(\`aws apigateway create-resource --rest-api-id=${process.env.AWS_REST_API_ID} --parent-id=\${currPath.id} --path-part=\${func.apiPath[index]}\`))
    } else {
      currPath = path
    }
  }
  try {
    await execute(\`aws apigateway put-method --rest-api-id=${process.env.AWS_REST_API_ID} --resource-id=\${currPath.id} --http-method=\${func.httpMethod} --authorization-type=NONE --no-api-key-required\`)
  } catch (putMethodErr) {
    console.error({putMethodErr})
  }
  const uri = \`arn:aws:apigateway:${process.env.AWS_REGION}:lambda:path/2015-03-31/functions/\${lambda.FunctionArn}/invocations\`
  try {
    await execute(\`aws apigateway put-integration --rest-api-id=${process.env.AWS_REST_API_ID} --resource-id=\${currPath.id} --http-method=POST --type=AWS_PROXY --integration-http-method=POST --content-handling=CONVERT_TO_TEXT --passthrough-behavior=WHEN_NO_MATCH --timeout-in-millis=10000 --uri=\${uri} \`)
  } catch (putIntegrationErr) {
    console.error({putIntegrationErr})
  }
}\n\n`
  )

  await write(
    writer,
    `async function deploy() {
  const { functionNames, functions } = JSON.parse(fs.readFileSync("build/deployParams.json"))
  const currFunctionsRaw = JSON.parse(await execute('aws lambda list-functions'))
  const currFunctions = currFunctionsRaw.Functions.map(item => item.FunctionName)
  const toExclude = currFunctions.filter(funcName => !functionNames.includes(funcName))\n
  for(var index = 0; index < toExclude.length; index++) {
    process.stdout.write(\`Deleting function \${toExclude[index]}...\`)
    await execute(\`aws lambda delete-function --function-name=\${toExclude[index]}\`)
    console.info('Done')
  }
  
  for(var index = 0; index < functions.length; index++) {
    const item = functions[index]
    process.stdout.write(\`[\${index + 1}/\${functions.length}] Deploying function \${item.name}...\`)
    await deployFunction(item)
    console.info('Done')
  }\n`
  )
  await write(writer, `}\n\ndeploy()`)
  writer.close()
}

buildAndWriteDeployFile()
