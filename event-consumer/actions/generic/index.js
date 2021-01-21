/*
* <license header>
*/

/**
 * This is a sample action showcasing how to access an external API
 *
 * Note:
 * You might want to disable authentication and authorization checks against Adobe Identity Management System for a generic action. In that case:
 *   - Remove the require-adobe-auth annotation for this action in the manifest.yml of your application
 *   - Remove the Authorization header from the array passed in checkMissingRequestInputs
 *   - The two steps above imply that every client knowing the URL to this deployed action will be able to invoke it without any authentication and authorization checks against Adobe Identity Management System
 *   - Make sure to validate these changes against your security requirements before deploying the action
 */

const fetch = require('node-fetch')
const { Core, Events } = require('@adobe/aio-sdk')
const { context, getToken } = require('@adobe/aio-lib-ims')
const stateLib = require('@adobe/aio-lib-state')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')

const slackWebhook = "https://hooks.slack.com/services/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"
const slackChannel = "Jie Yu"
const request = require('request')



async function sendToSlack(msg) {
  var slackMessage = " Event received: " + msg;
  return new Promise(function (resolve, reject) {
    var payload = {
      "channel": slackChannel,
      "username": "incoming-webhook",
      "text": slackMessage,
      "mrkdwn": true,
    }

    var options = {
      method: 'POST',
      url: slackWebhook,
      headers:
          { 'Content-type': 'application/json' },
      body: JSON.stringify(payload)
    }

    request(options, function (error, response, body) {
      if (error) {
        reject(error)

      } else {
        resolve(response)
      }

    })
  })
}

async function fetchEvent(params, token, since) {
  const eventsClient = await Events.init(params.ims_org_id, params.apiKey, token)

  if (since == null) {
    journalling = await eventsClient.getEventsFromJournal(params.journalling_url)
  } else {
    journalling = await eventsClient.getEventsFromJournal(params.journalling_url, {since: since})
  }
  
  return journalling.events[0]
}

async function saveToDb(params, event) {
  const state = await stateLib.init()


  var events = await state.get(params.db_event_key) 
  if (events === undefined) {
    events = {latest: event, events: [event]}
  } else {
    events = events.value
    events.latest = event
    events.events.push(event)
  }
  await state.put(params.db_event_key, events, { ttl: -1 })
}

async function getLatestEvent(params) {
  const state = await stateLib.init()
  const events = await state.get(params.db_event_key)
  if (events === undefined) {
    return null
  } else {
    return events.value.latest
  }
}

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the main action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    const config = {
      client_id: params.client_id,
      client_secret: params.client_secret,
      technical_account_email: params.technical_account_email,
      technical_account_id: params.technical_account_id,
      meta_scopes: ['ent_adobeio_sdk'],
      ims_org_id: params.ims_org_id,
      private_key: params.private_key
    };
    await context.set('my_event_provider', config)
    await context.setCurrent('my_event_provider')

    const token = await getToken()


    var latestEvent = await getLatestEvent(params)
    var event = await fetchEvent(params, token, latestEvent.position)

    var fetch_cnt = 0
    while (event != null) {
      logger.info("Got an event, send it to slack and save to DB, event position is: " + event.position)
      await saveToDb(params, event)
      msg = JSON.stringify(event)
      await sendToSlack(msg)
      fetch_cnt = fetch_cnt + 1
      if (fetch_cnt >= params.max_events_in_batch) {
        break
      }
      event = await fetchEvent(params, token, event.position)
    }
    
    return event

  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
