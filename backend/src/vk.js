const axios = require("axios");
const { VK_SERVICE_KEY, VK_API_VERSION } = require("./config");

const API_BASE = "https://api.vk.com/method";

async function vkRequest(method, params) {
  const requestParams = {
    ...params,
    access_token: VK_SERVICE_KEY,
    v: VK_API_VERSION
  };

  const sanitizedParams = {
    ...requestParams,
    access_token: VK_SERVICE_KEY ? "<redacted>" : undefined
  };

  console.log("VK API request", {
    url: `${API_BASE}/${method}`,
    method,
    params: sanitizedParams
  });
  const response = await axios.get(`${API_BASE}/${method}`, {
    params: requestParams
  });

  if (response.data.error) {
    const { error_code, error_msg } = response.data.error;
    throw new Error(`VK API error ${error_code}: ${error_msg}`);
  }

  return response.data.response;
}

async function fetchWallPosts({ ownerId, count, offset }) {
  return vkRequest("wall.get", {
    domain: ownerId,
    count,
    offset,
    extended: 1,
    fields: "name"
  });
}

module.exports = {
  fetchWallPosts
};
