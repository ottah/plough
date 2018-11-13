import axios, { AxiosInstance } from "axios";
import colors from "colors";
import fs from "fs";
import path from "path";
import shell from "shelljs";
import { CardFileMap, CardFileMapEntry } from "./CardFileMap/";
import CardImage from "./CardImage";
import { Card, CardAPIObject, CardSet } from "./CardSetInterfaces";
import CDN, { CDNResponse } from "./CDN";
import { fragmentCard } from "./fragmentCards";

// Get set CDN
export async function getSetCDN(api: AxiosInstance, id: number): Promise<CDN> {
  const url = `/${id}/`;
  if (id < 0) {
    throw new Error("Set numbers cannot be below 0");
  }
  return api.get(url).then((response) => {
    return response.data;
  }).then((data) => {
    return new CDN({ ...data, setId: id });
  });
}

// get set json
export async function getSetJSON(cdn: CDN): Promise<CardAPIObject> {
  console.log("Retrieving set " + cdn.setId, cdn.fullURL);
  return axios
    .get(cdn.fullURL, {
      transformResponse: [transformToJSON],
    })
    .then((response) => response.data);
}

export class SaveSetOptions {
  public downloadImages: boolean = false;
  public redownloadImages: boolean = false;
  public fragmentCards: boolean = false;

  constructor(options?: Partial<SaveSetOptions>) {
    Object.assign(this, options);
  }
}

export async function saveSet(set: CardAPIObject, filePath: string, options: SaveSetOptions = new SaveSetOptions()): Promise<boolean> {
  // Make folder for set
  console.log("Working in " + filePath);
  const setId = set.card_set.set_info.set_id;
  const setFolderPath = path.normalize(`${filePath}/sets/set-${setId}`);
  const setFilePath = path.normalize(`${setFolderPath}/set.json`);
  shell.mkdir("-p", setFolderPath);
  // save json file
  const setJSONString = JSON.stringify(set, undefined, 2);
  fs.writeFile(setFilePath, setJSONString, (err) => {
    if (err) { throw err; }
    console.log("Saved set.json");
  });
  // save cardmap
  const cardMapJSONString = JSON.stringify(CardFileMap.createMap(set), undefined, 2);
  const jobs: Array<Promise<any>> = [];
  fs.writeFile(setFolderPath + "/cardmap.json", cardMapJSONString, (err) => {
    if (err) { throw err; }
    console.log("Card file map created.");
  });
  // make cards folder
  if (options.downloadImages || options.fragmentCards) {
    const cardsFolderPath = path.normalize(setFolderPath + "/cards");
    shell.mkdir("-p", cardsFolderPath);
    // create folder for each card id
    console.log("Creating card fragment folders");
    jobs.concat(set.card_set.card_list.slice(0, 10).map(async (card) => shell.mkdir(cardsFolderPath + "/" + card.card_id)));
    console.log("Card fragment folders created");
  }
  // Save images
  if (options.downloadImages) {
    // create cards folder
    const cardPath = setFolderPath + "/cards";
    jobs.concat(downloadAllCardsImages(set.card_set.card_list, cardPath));
  }
  if (options.fragmentCards) {
    // Fragment cards
    jobs.concat(set.card_set.card_list.map(async (card) => fragmentCard(card, setFolderPath + "/cards")));
  }
  // save fragments
  console.log(colors.bold.magenta("Waiting for jobs to complete for set #" + setId));
  return await Promise.all(jobs).then(() => true);
}

export async function downloadAllCardsImages(cards: Card[], filePath: string) {
  return Promise.all(cards.map(async (card) => downloadCardImages(card, filePath))).then((result) => {
    console.log(colors.bold.green("Downloaded all images to " + filePath));
    return result;
  });
}

export async function downloadCardImages(card: Card, folderPath: string) {
  const cardFolderPath = folderPath + "/" + card.card_id;
  const images: CardImage[] = [
    new CardImage("mini", ".png", card.mini_image.default),
    new CardImage("large", ".png", card.large_image.default),
    new CardImage("ingame", ".png", card.ingame_image.default),
  ];

  return Promise.all(images.map((img) => img.download(cardFolderPath)));
}

/**
 * Transforms JSON response to an object.
 *
 * @param {string} data
 * @returns {Promise<object>}
 */
export function transformToJSON(data: string): Promise<object> {
  return JSON.parse(data);
}

export function removeFolder(filePath: string) {
  if (filePath !== "/") {
    shell.rm("-rf", filePath);
  }
}
