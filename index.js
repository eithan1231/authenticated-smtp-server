const cluster = require('cluster')
const os = require('os')

// TODO: Envinment variable for fork count
const forkCount = os.cpus().length

const workerSMTP = require('./workerSmtp')
const workerJob = require('./workerJob')

if (cluster.isWorker) {
  switch (process.env.type) {
    case 'job':
      console.log(`Job Worker ${cluster.worker.id} started`)
      workerJob()
      break

    case 'smtp':
      console.log(`SMTP Worker ${cluster.worker.id} started`)
      workerSMTP()
      break

    default: throw new Error(`Unexpected worker type ${process.env.type}`)
  }
}

if (cluster.isMaster) {
  // id: type
  const workerTypes = { }

  // forks worker and auto-pupulates workerTypes
  const forkWorker = (type) => {
    console.log(`Forking ${type} worker`)

    const tmpWorker = cluster.fork({ type })
    workerTypes[tmpWorker.id] = type
  }

  // spawning
  for (let i = 0; i < forkCount; i++) {
    forkWorker('job')
    forkWorker('smtp')
  }

  cluster.on('message', console.log)

  cluster.on('exit', (worker, code, signal) => {
    const type = workerTypes[worker.id]

    // calculating amount of re-fork attempts from the amount of workerTypes.
    const retryCount = workerTypes.length - forkCount

    if (retryCount < 10) {
      console.log(`Worker ${worker.id} ${type} exited code ${code} (sig: ${signal}). retrying`)
      forkWorker(type)
    } else {
      console.log(`Worker ${worker.id} ${type} exited code ${code} (sig: ${signal}). Exceeded refork threshole.`)
    }

    delete workerTypes[worker.id]
  })
}
