/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
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
const { Core, Events, State } = require('@adobe/aio-sdk')
const { context, getToken } = require('@adobe/aio-lib-ims')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')

const request = require('request')

async function sendToSlack(slackWebhook, slackChannel, msg) {
  var slackMessage = " Event received: " + msg;
  return new Promise(function (resolve, reject) {
    var payload = {
      "channel": slackChannel,
      "text": slackMessage,
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

  let options = {}
  if(since != null) {
    options.since = since
  }
  journalling = await eventsClient.getEventsFromJournal(params.journalling_url, options)
  
  return journalling.events
}

async function saveToDb(params, new_events) {
  const stateCLient = await State.init()


  var events = await stateCLient.get(params.db_event_key) 
  if (events === undefined) {
    events = {latest: new_events[new_events.length - 1], events: new_events}
  } else {
    events = events.value
    events.latest = new_events[new_events.length - 1]
    events.events.push(new_events)
  }
  await stateCLient.put(params.db_event_key, events, { ttl: -1 })
}

async function getLatestEventPosition(params) {
  const stateCLient = await State.init()
  const events = await stateCLient.get(params.db_event_key)
  if (events === undefined) {
    return null
  } else {
    return events.value.latest.position
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


    var latestEventPos = await getLatestEventPosition(params)
    logger.info("Fetch Event since position: " + latestEventPos)
    var events = await fetchEvent(params, token, latestEventPos)

    var fetch_cnt = 0
    while (events != undefined) {
      logger.info("Got an event, send it to slack and save to DB, event position is: " + events[events.length - 1].position)
      await saveToDb(params, events)
      msg = JSON.stringify(events)
      if (params.slack_webhook != undefined && params.slack_channel != undefined) {
        logger.info("============== send to slack")
        await sendToSlack(params.slack_webhook, params.slack_channel, msg)
      }
      
      fetch_cnt = fetch_cnt + 1
      if (fetch_cnt >= params.max_events_in_batch) {
        break
      }
      events = await fetchEvent(params, token, events[events.length - 1].position)
    }
    
    return events

  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
