/**
* Application for Agenda Jobs
*/

const agenda = require('./library/agenda')

function main () {
  agenda.start()
}

module.exports = main
