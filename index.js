import webdriver from "selenium-webdriver";
import { app as firebaseApp, db as firebaseDB } from "./firebase.js";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { Telegraf } from "telegraf";
import { config } from "dotenv";
import { Options } from "selenium-webdriver/chrome.js";
import fs from "fs";
import UserAgent from "user-agents";

config();

const sleepTimer = 1000 * 60 * 1;
const token = process.env.TOKEN;
const telegramId = process.env.ID;
const tellonymId = process.env.TELLID;
// const tellonymId = 76847017;

const useragent = new UserAgent();
const options = new Options();
options.addArguments("--headless=new");
options.addArguments('user-agent="' + useragent.toString() + '"');
options.addArguments("--incognito")
options.addArguments("--nogpu")
options.addArguments("--disable-gpu")
options.addArguments("--window-size=1980,960")
options.addArguments("--no-sandbox")
options.addArguments("--enable-javascript")
options.addArguments('--disable-blink-features=AutomationControlled')
let driver = new webdriver.Builder()
  .forBrowser("chrome")
  .setChromeOptions(options)
  .build();


const bot = new Telegraf(token);

const fetchData = async () => {
  try {
    // await driver.manage().window().minimize();
    // console.log("minimized the window");
    await driver.get(
      // `https://api.tellonym.me/profiles/name/khkhkhkhkhkhkh?limit=20`
      `https://api.tellonym.me/profiles/id/${tellonymId}?limit=20`
    );

    const text = await (
      await driver.findElement(webdriver.By.css("pre"))
    ).getText();

    const parsed = JSON.parse(text);
    console.log(parsed.answers.length);
    console.log(
      "Parsed Answers From Web",
      "\n Ids:",
      parsed.answers.filter((ans) => ans.type === 0).map((ans) => ans.id)
    );
    await dealWithData(parsed);
  } catch (error) {
    console.log(error);
  } finally {
    // await sleep(4000);
    // driver.close();
  }
};
const dealWithData = async (data) => {
  try {
    if (data.answers.length < 1) return;

    const collectionRef = collection(firebaseDB, "Ids");
    const collectionQuery = query(
      collectionRef,
      limit(10),
      orderBy("id", "desc")
    ); // add ordering later by id
    const snapshotDocs = await getDocs(collectionQuery);
    const docs = snapshotDocs.docs.map((doc) => doc.data());
    const lastDocId = Number(docs[0]?.id) || 0;

    const answers = data.answers.filter(
      (ans) => ans.id > lastDocId && ans.type === 0
    ).reverse();

    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];
      const parentTell = answer?.parent?.content;
      const tell = answer?.tell;

      const result = await addDoc(collectionRef, answer);

      const texted = `${parentTell ? `Parent Tell : \n ${parentTell} \n` : ""}${tell ? `Tell : \n ${tell} \n` : ""
        }New Tell Answered : \n ${answer.answer}`;

      if (answer.media.length > 0) {
        await bot.telegram.sendMediaGroup(
          telegramId,
          answer.media.map((media, ind) => ({
            type: "photo",
            media: media.url,
            caption: ind === 0 ? texted : ""
          }))
        );
      } else {
        await bot.telegram.sendMessage(telegramId, texted);
      }

      console.log(
        "Added a new tell with Id : ",
        result.id,
        "\n",
        "Created At : ",
        new Date()
      );
    }
  } catch (err) {
    console.log(err);
  }
};

async function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

// run cron job every two minutes
async function run() {
  try {

    console.log("Starting...");
    const perfNow = new Date().getTime();
    await fetchData();
    const perfEnd = new Date().getTime();
    console.log("Finished In ", perfEnd-perfNow, " ms");
  } catch (error) {
    console.log(error)
  } finally {
    // await sleep(20000);
    await sleep(sleepTimer);
    await run();
  }
}
run();
