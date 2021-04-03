const jobsMail = require('./jobs/Mail')

const Agenda = require('agenda')

const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')

const mongodbConfig = yaml.load(fs.readFileSync(
  path.join(__dirname, '../config/mongodb.yaml')
))

const agenda = new Agenda({
  db: {
    ...mongodbConfig,
    options: {
      useUnifiedTopology: true
    }
  }
})

agenda.on('error', console.error)

jobsMail(agenda)

module.exports = agenda
