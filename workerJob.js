/**
* Application for Agenda Jobs
*/

const agenda = require('./library/Agenda')

function main () {
  agenda.start()
}

module.exports = main
