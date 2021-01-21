/*
* <license header>
*/

/**
 * This is a sample action showcasing how to create a cloud event and publish to I/O Events
 *
 * Note:
 * You might want to disable authentication and authorization checks against Adobe Identity Management System for a generic action. In that case:
 *   - Remove the require-adobe-auth annotation for this action in the manifest.yml of your application
 *   - Remove the Authorization header from the array passed in checkMissingRequestInputs
 *   - The two steps above imply that every client knowing the URL to this deployed action will be able to invoke it without any authentication and authorization checks against Adobe Identity Management System
 *   - Make sure to validate these changes against your security requirements before deploying the action
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
