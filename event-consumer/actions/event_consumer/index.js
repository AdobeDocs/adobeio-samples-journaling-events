const { Core, Events } = require('@adobe/aio-sdk')
const stateLib = require('@adobe/aio-lib-state')
const { errorResponse } = require('../utils')
const { context, getToken } = require('@adobe/aio-lib-ims')
const fetch = require('node-fetch')

/*
 * Retrieves an access token using IMS technical account credentials.
 *
 * @param {Object} params - Parameters containing IMS credentials and scopes.
 * @param {string} params.client_id - Client ID.
 * @param {string} params.client_secret - Client secret.
 * @param {string} params.ims_org_id - IMS organization ID.
 * @param {string} params.technical_account_id - Technical account ID.
 * @param {string} params.technical_account_email - Technical account email.
 * @param {Array<string>} params.scopes - Array of IMS scopes.
 * @returns {Promise<string>} - The access token.
 */
async function getAccessToken(params) {
  const scopesArray = params.scopes
  const config = {
    client_id: params.client_id,
    client_secrets: [params.client_secret], // must be an array for aio-lib-ims
    ims_org_id: params.ims_org_id,
    technical_account_id: params.technical_account_id,
    technical_account_email: params.technical_account_email,
    scopes: scopesArray
  }

  // Set the IMS context and mark it as current
  await context.set('my_event_provider', config)
  await context.setCurrent('my_event_provider')

  const token = await getToken()
  return token
}

/*
 * Fetches events from an Adobe I/O Events journalling endpoint.
 *
 * @param {Object} params - Parameters containing journalling credentials.
 * @param {string} params.ims_org_id - IMS organization ID.
 * @param {string} params.apiKey - API key for the integration.
 * @param {string} params.journalling_url - URL to the journalling endpoint.
 * @param {string} accessToken - IMS access token.
 * @param {string} [sincePosition] - Optional journal position to fetch events from.
 * @returns {Promise<Array<Object>>} - Array of fetched events.
 */
async function fetchEvent(params, accessToken, sincePosition) {
  const { ims_org_id, apiKey, journalling_url } = params

  if (!ims_org_id || !apiKey || !accessToken || !journalling_url) {
    throw new Error('Missing Adobe I/O credentials in action params')
  }

  const eventsClient = await Events.init(ims_org_id, apiKey, accessToken)

  const options = {}
  if (sincePosition) {
    options.since = sincePosition  // Only fetch events newer than this position
  }

  options.limit = 100 // Limit to 100 events per fetch
  const journalling = await eventsClient.getEventsFromJournal(journalling_url, options)
  return journalling.events || []
}

/*
 * Main function for Adobe I/O Runtime action.
 * Fetches events from a journalling endpoint, logs them, and stores journal position.
 *
 * @param {Object} params - Input parameters for the action.
 * @returns {Promise<Object>} - Result with success flag and event details.
 */
async function main(params) {
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })
  logger.info('Fetching events from journalling endpoint...')

  try {
    // Acquire IMS access token
    const accessToken = await getAccessToken(params)
    if (!accessToken) {
      throw new Error('Missing access_token in params')
    }

    // Initialize state store using Adobe I/O Runtime credentials
    const state = await stateLib.init()

    // Retrieve the last journal position from the state store
    const lastPositionRes = await state.get(params.db_event_key)
    const lastPosition = lastPositionRes ? lastPositionRes.value : undefined
    logger.info(`Last Position >>>` + lastPosition)

    // Fetch new events from journal starting from the last position
    const events = await fetchEvent(params, accessToken, lastPosition)
    logger.info(`Fetched ${events.length} new event(s).`)

    if (events.length > 0) {
      // Loop through each event and log key details
      events.forEach((event, index) => {
        logger.info(`--- Event #${index + 1} ---`)
        logger.info(`Raw Payload:\n${JSON.stringify(event, null, 2)}`)

        // Extract and log commonly used fields if present
        if (event.event) {
          logger.info(`Event ID: ${event.event.id}`)
          logger.info(`Type: ${event.event.type}`)
          logger.info(`Time: ${event.event.time}`)

       
        }
      })

      // Save the journal position of the last event processed
      const newestPosition = events[events.length - 1].position
      await state.put(params.db_event_key, newestPosition)
      logger.info(`Updated last processed position: ${newestPosition}`)
    }

    return { success: true, events_fetched: events.length, events }
  } catch (error) {
    logger.error('Fetch failed with error:', error)
    return errorResponse(500, error.message, logger)
  }
}

exports.main = main
