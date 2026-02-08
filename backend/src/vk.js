const axios = require("axios");
const { VK_SERVICE_KEY, VK_API_VERSION } = require("./config");

const API_BASE = "https://api.vk.com/method";

async function vkRequest(method, params) {
  const response = await axios.get(`${API_BASE}/${method}`, {
    params: {
      ...params,
      access_token: VK_SERVICE_KEY,
      v: VK_API_VERSION
    }
  });

  if (response.data.error) {
    const { error_code, error_msg } = response.data.error;
    throw new Error(`VK API error ${error_code}: ${error_msg}`);
  }

  return response.data.response;
}

async function fetchWallPosts({ ownerId, count, offset }) {
  return vkRequest("wall.get", {
    owner_id: ownerId,
    count,
    offset
  });
}

module.exports = {
  fetchWallPosts
};
