'use strict';

const { getEnvironment, response, handleOptions, assertMethod, errorResponse } = require('./_vgg-crm-common');

exports.handler = async (event) => {
  const options = handleOptions(event);
  if (options) return options;
  try {
    assertMethod(event, ['GET']);
    const { url, publishableKey } = getEnvironment();
    return response(event, 200, { supabaseUrl: url, supabasePublishableKey: publishableKey });
  } catch (error) {
    return errorResponse(event, error);
  }
};
