errorEventCreate();

import { createHTTPRequest, getLocalStorage, setLocalStorage, localStorageBytes, getSyncStorage, setSyncStorage, syncStorageBytes } from '../utility.js';
import { hypixelRequestPlayer } from './APIRequests/hypixelRequestPlayer.js';
import { slothpixelRequestPlayer } from './APIRequests/slothpixelRequestPlayer.js';
import { requestUUID } from './APIRequests/requestUUID.js';
import { detailMessage } from './messageComponents/detailMessage.js';
import { explanationMessage } from './messageComponents/explanationMessage.js';

let outputElement = document.getElementById('outputElement');
let player;

document.getElementById('submitPlayer').addEventListener('submit', x => processPlayer(x).catch(errorHandler));
persistentPlayer().catch(errorHandler);

async function persistentPlayer() {
  try {
    let { userOptions } = await getSyncStorage('userOptions');
    if (userOptions.persistentLastPlayer === false) return;
    let { playerHistory } = await getLocalStorage('playerHistory');
    if (playerHistory?.lastSearches.length === 0 || playerHistory?.lastSearchCleared === true) return;
    let text = playerDataString(playerHistory?.lastSearches[0]?.apiData, userOptions);
    userOptions.typewriterOutput = false;
    return await outputField(text, userOptions, outputElement);
  } catch (err) {
    throw err;
  }
}

async function processPlayer(event) {
  try {
    event.preventDefault();
    player = document.getElementById('playerValue').value.replace(/^\s/, '');
    let { userOptions } = await getSyncStorage('userOptions');
    document.getElementById('playerValue').value = '';
    outputElement.textContent = 'Loading..';
    if (userOptions.useHypixelAPI === true && !userOptions.apiKey) {let x =  new Error(); x.name = 'KeyError'; throw x}
    let submitButton = document.getElementById('submitButton');
    submitButton.disabled = true;
    submitButton.style.cursor = 'not-allowed';
    let apiData = await callAPIs(player, userOptions);
    let text = playerDataString(apiData, userOptions);
    await updatePlayerHistory(apiData); //Might add a <promise>.catch to allow it to continue if this fails
    return await outputField(text, userOptions, outputElement);
  } catch (err) {
    throw err;
  }
}

async function callAPIs(player, userOptions) {
  try {
    let uuidRegex = /^[0-9a-f]{8}(-?)[0-9a-f]{4}(-?)[1-5][0-9a-f]{3}(-?)[89AB][0-9a-f]{3}(-?)[0-9a-f]{12}$/i;
    if (userOptions.useHypixelAPI === false) return await slothpixelRequestPlayer(player);
    else if (uuidRegex.test(player)) return await hypixelRequestPlayer(player, userOptions.apiKey);
    else {
      let playerUUID = await requestUUID(player);
      return await hypixelRequestPlayer(playerUUID, userOptions?.apiKey);
    }
  } catch (err) {
    throw err;
  }
}

function playerDataString(apiData, userOptions) {
  if (userOptions.paragraphOutput === false) return detailMessage(apiData, userOptions);
  else return explanationMessage(apiData, userOptions);
}

async function outputField(text, userOptions, outputElement) {
  try {
    if (userOptions?.typewriterOutput === false) return outputElement.innerHTML = text;

    for (let i = 0; i < text.length; i += 2) {
      outputElement.innerHTML = text.slice(0, i + 1);
      await new Promise(t => setTimeout(t, 0));
    }
  } catch (err) {
    throw err;
  }
}

async function updatePlayerHistory(apiData) {
  try {
    let thisPlayerHistory = new Object();
    thisPlayerHistory.uuid = apiData.uuid;
    thisPlayerHistory.username = apiData.username;
    thisPlayerHistory.epoch = `${Date.now()}`;
    thisPlayerHistory.apiData = apiData;
  
    let { playerHistory } = await getLocalStorage('playerHistory');
    playerHistory?.lastSearches.unshift(thisPlayerHistory);
    playerHistory?.lastSearches.splice(100);
    playerHistory.lastSearchCleared = false;
    if (playerHistory?.lastSearches[1]?.apiData) delete playerHistory?.lastSearches[1]?.apiData;
    return await setLocalStorage({ 'playerHistory': playerHistory });
  } catch (err) {
    throw err;
  }
}

function errorEventCreate() {
  window.addEventListener('error', x => errorHandler(x, x.constructor.name));
  window.addEventListener('unhandledrejection', x => errorHandler(x, x.constructor.name));
}

async function errorHandler(event, errorType = "caughtError", err =  event?.error ?? event?.reason ?? event) { //Default type is "caughtError"
  try {
    console.error(`${new Date().toLocaleTimeString('en-IN', { hour12: true })} | Error Source: ${errorType} |`, err?.stack ?? event);
    let { userOptions } = await getSyncStorage('userOptions').catch(() => {});
    let errorOutput = document.getElementById('outputElement');
    let apiType = userOptions?.useHypixelAPI === true ? 'Hypixel API' : 'Slothpixel API'; //The UUID API could fail, but switching to the Slothpixel API would "fix" it
    let oppositeAPIType = userOptions?.useHypixelAPI === false ? 'Hypixel API' : 'Slothpixel API';
    let usernameOrUUID = /^[0-9a-f]{8}(-?)[0-9a-f]{4}(-?)[1-5][0-9a-f]{3}(-?)[89AB][0-9a-f]{3}(-?)[0-9a-f]{12}$/i.test(player) ? 'UUID' : 'username';
    errorOutput.textContent = '';
    switch (err?.name) {
      case 'AbortError':
        errorOutput.textContent = `The ${apiType} failed to respond twice. It may be down. Try switching to the ${oppositeAPIType} if this persists.`;
      break;
      case 'NotFound':
        let temp0 = document.createElement('a');
        temp0.setAttribute('href', `https://namemc.com/search?q=${player}`);
        temp0.setAttribute('title', 'Opens a new tab to NameMC with your search query');
        temp0.setAttribute('target', '_blank');
        temp0.textContent = 'NameMC';
        errorOutput.append(`The ${usernameOrUUID} "${player}" isn't a valid player and couldn't be found. `, temp0);
      break;
      case 'HTTPError':
        if (err.status === 500 && userOptions?.useHypixelAPI === false) errorOutput.textContent = `Slothpixel returned an error; this happens regularly. Try switching to the Hypixel API if this continues.`;
        else if (err.status === 403 && userOptions?.useHypixelAPI === true) {
          let temp1 = document.createElement('b');
          temp1.textContent = '/api'
          errorOutput.append("Invalid API key! Please either switch to the Slothpixel API or get a new API key with ", temp1, ' on Hypixel.');
        }
        else errorOutput.textContent = `An unexpected HTTP code was returned. ${err.message}. Try switching to the ${oppositeAPIType} if this persists.`;
      break;
      case 'KeyError':
        let temp2 = document.createElement('b');
        temp2.textContent = '/api'
        errorOutput.append("You don't have an API key to use the Hypixel API! Either switch to the Slothpixel API in the options or use ", temp2, ' new on Hypixel and enter the key!');
      break;
      case 'ChromeError':
        errorOutput.textContent = `An error occured. ${err?.message}`;
      break;
      case null:
      case undefined:
        errorOutput.textContent = `An error occured. No further information is available here; please check the dev console and contact Attituding#6517 if this error continues appearing.`;
      break;
      default:
        errorOutput.textContent = `An error occured. ${err?.name}: ${err?.message}. Please contact Attituding#6517 if this error continues appearing.`;
      break;
    }
  } catch (err) {
    console.error(`${new Date().toLocaleTimeString('en-IN', { hour12: true })} | Error-Handler Failure |`, err?.stack ?? event);
  }
}