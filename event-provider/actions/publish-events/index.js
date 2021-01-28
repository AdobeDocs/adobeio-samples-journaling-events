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

const { Core, Events } = require('@adobe/aio-sdk')
const uuid = require('uuid')
const cloudEventV1 = require('cloudevents-sdk/v1')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')
const { context, getToken } = require('@adobe/aio-lib-ims')

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
    
    // initialize the client
    const eventsClient = await Events.init(params.ims_org_id, params.apiKey, token)

    // Create cloud event for the given payload
    // we are using current time as payload
    const currentTime = new Date()
    payload = currentTime.toLocaleString()
    const cloudEvent = createCloudEvent(params.providerId, params.eventCode, payload)

    // Publish to I/O Events
    const published = await eventsClient.publishEvent(cloudEvent)
    let statusCode = 200
    if (published === 'OK') {
      logger.info('Published successfully to I/O Events')
    } else if (published === undefined) {
      logger.info('Published to I/O Events but there were not interested registrations')
      statusCode = 204
    }
    const response = {
      statusCode: statusCode,
    }

    // log the response status code
    logger.info(`${response.statusCode}: successful request`)
    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error'+error+params, logger)
  }
}

function createCloudEvent(providerId, eventCode, payload) {
  let cloudevent = cloudEventV1.event()
    .data(payload)
    .source('urn:uuid:' + providerId)
    .type(eventCode)
    .id(uuid.v4())
  return cloudevent.format()
}
exports.main = main
