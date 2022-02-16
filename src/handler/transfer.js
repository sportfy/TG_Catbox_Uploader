import CatBoxMoe from "catbox.moe";
import { MAX_DOWNLOADING, chatData, LOG_CHANNEL_ID } from "./index.js";
import strings from "../strings.js";
import * as fs from "fs";
import { bot } from "../../index.js";
import mime from 'mime-types';

const CatBox = new CatBoxMoe.Catbox();
const LitterBox = new CatBoxMoe.Litterbox();

export async function transfer(msg) {
    let chat = parseInt(msg.peerId.userId.value);
    let file = msg.media, fileSize, fileExt, fileName = randomString(), filePath;
    let lang = chatData[chat].lang, service = chatData[chat].service, editMsg;

    if (chatData[chat].downloading >= MAX_DOWNLOADING)
        return bot.sendMessage(chat, { message: strings[lang].flood_protection.replace('{s}', MAX_DOWNLOADING) });

    if (file.document) {
        fileSize = file.document.size;
        fileExt = mime.extension(file.document.mimeType);
    }
    else if (file.photo) {
        let sizes = file.photo.sizes[file.photo.sizes.length - 1].sizes;
        fileSize = sizes[sizes.length - 1];
        fileExt = 'png';
    }

    if ((service === 'Catbox' &&  fileSize > 200000000) || (service === 'Litterbox' && fileSize > 1000000000))
        return bot.sendMessage(chat, { message: strings[lang].err_FileTooBig.replace('{s}', service) });

    editMsg = await bot.sendMessage(chat, { message: strings[lang].downloading, replyTo: msg.id });
    chatData[chat].downloading++;
    if (LOG_CHANNEL_ID) {
        let log = await bot.forwardMessages(LOG_CHANNEL_ID, {messages: msg.id, fromPeer: chat}).catch(console.error);
        await bot.sendMessage(LOG_CHANNEL_ID, { message: `From: \`${chat}\`\nService: ${service}`, replyTo: log[0].id });
    }

    if (!fs.existsSync('./cache'))
        fs.mkdirSync('./cache');

    while (fs.existsSync(`./cache/${chat}_${fileName}.${fileExt}`))
        fileName = randomString();
    filePath = `./cache/${chat}_${fileName}.${fileExt}`;

    console.log(`${chat} 开始下载文件`);
    let buffer = await bot.downloadMedia(file, {});
    fs.writeFileSync(filePath, buffer);
    console.log(`${chat} 文件下载完成`);
    await bot.editMessage(chat, { message: editMsg.id, text: strings[lang].uploading.replace('{s}', service) });

    try {
        let result;
        if (service.toLowerCase() === 'catbox') {
            result = await CatBox.upload(filePath).catch((e) => {
                throw new Error(e);
            });
        }
        else
            result = await LitterBox.upload(filePath, chatData[chat].litterBoxExpr).catch((e) => {
                throw new Error(e);
            });
        bot.editMessage(chat, {
            message: editMsg.id, text: strings[lang].uploaded
                .replace('{s}', service.toLowerCase() === 'catbox' ? '∞' : chatData[chat].litterBoxExpr) + result
        }).catch(() => null);
    }
    catch (e) {
        console.error(`Error when uploading file from ${chat}:`, e);
        await bot.sendMessage(chat, { message: strings[lang].error + `\n${e.message}` });
    }
    finally {
        fs.rmSync(filePath);
        chatData[chat].downloading--;
    }
}

function randomString(e = 8) {
    let t = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678",
        a = t.length,
        n = "";
    for (let i = 0; i < e; i++)
        n += t.charAt(Math.floor(Math.random() * a));
    return n;
}