// Require the necessary discord.js classes
const { Events, Client, GatewayIntentBits, Partials } = require("discord.js");
const {
  createAudioResource,
  createAudioPlayer,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const { joinVoiceChannel } = require("@discordjs/voice");
const { exec } = require("youtube-dl-exec");
const play = require("play-dl");

const { token } = require("./config.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel],
});

client.audioConnection = null;
client.audioPlayer = null;
client.audioSubscription = null;
client.audioQueue = [];
client.isPlaying = false;
client.hasIdleListener = false;
client.currentSong = null;
client.loopAudio = false;

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on(Events.MessageCreate, async (msg) => {
  switch (msg.content) {
    case msg.content.match(/https:\/\/(www\.youtube\.com)|(youtu\.be)/)?.input:
      let singleSong = {};
      if (
        [...msg.content.matchAll(/https:\/\/(www\.youtube\.com)|(youtu\.be)/g)]
          .length > 1
      ) {
        // if got bundle of songs parse them and queue them
        const links = await Promise.all(
          normalizeLinks(msg.content).map(async (link) => {
            const { durationInSec } = (await play.video_basic_info(link))
              .video_details;
            console.log(client.audioQueue.length);
            return { audioUrl: link, durationInSec };
          })
        );
        client.audioQueue.push(...links);
        console.log(client.audioQueue, "queue after links were mapped here");
      } else {
        const audioUrl = msg.content;
        const { durationInSec } = (await play.video_basic_info(audioUrl))
          .video_details;
        const song = { audioUrl, durationInSec };
        singleSong = song;
        if (singleSong.audioUrl.match(/https:\/\/(youtu\.be)/g)) {
          singleSong.audioUrl = remapYtBeLink(singleSong.audioUrl);
        }
      }
      console.log("yt url recieved, getting video info...");

      console.log("getting voice channel info...");
      const { channel } = msg.member.voice;

      if (!channel) {
        console.log("You must be in voice channel to play music");
        return;
      }

      console.log("checking if there is connection and a player");

      if (!client.audioConnection) {
        console.log("creating new connection");
        client.audioConnection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
        });

        client.audioPlayer = createAudioPlayer();
        client.audioSubscription = client.audioConnection.subscribe(
          client.audioPlayer
        );
        console.log("player and connection created");
      }
      if (!client.audioPlayer) {
        client.audioPlayer = createAudioPlayer();
        client.audioSubscription = client.audioConnection.subscribe(
          client.audioPlayer
        );
        console.log("player created");
      }
      console.log("checking if already playing", client.isPlaying);
      if (client.isPlaying) {
        console.log("already playing a song, adding to queue");
        client.audioQueue.push(singleSong);
        console.log("added, current queue:", client.audioQueue);
      } else if (singleSong.audioUrl) {
        console.log(
          "no queue or is not playing, playing recieved url:",
          singleSong.audioUrl
        );
        await playAudio(singleSong, client.audioPlayer);
      } else {
        console.log(client.audioQueue);
        await playAudio(getNextInQ(client.audioQueue), client.audioPlayer);
      }
      if (!client.hasIdleListener) {
        createIdleListener(client);
      }
      break;
    case "skip":
      if (client.audioQueue.length) {
        await playAudio(getNextInQ(client.audioQueue), client.audioPlayer);
      } else {
        console.log("nothing to skip stopping");
        disconnectClient(client);
      }
      break;
    case "stop":
      console.log("got stop request, aborting...");
      disconnectClient(client);
      break;
    case "loop":
      console.log("got loop command, repeating current song...");
      msg.reply("пока не сделал :Р");
      client.loopAudio = true;
      // create new event listener in place of old one where one song repeats
      break;
    case "stopLoop":
      console.log("stopping current loop...");
      client.loopAudio = false;
      msg.reply("пока не сделал :Р");
      // create event listener of old format with queue active
      break;
    default:
      console.log("non yt url message recieved:", msg.content);
  }
});

client.on(Events.Error, (e) => {
  console.error(e);
});
// // Login to Discord with your client's token
client.login(token);

const playAudio = async (song, player) => { 
  const { audioUrl, durationInSec } = song;
  console.trace("play call, url:");
  const stream = await play.stream(audioUrl);
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
  });
  await player.play(resource);
  client.currentSong = audioUrl;
  client.isPlaying = true;
  console.log("after play", client.isPlaying);
  if (client.audioQueue.length > 0) {
    client.audioQueue.shift();
  }
  return new Promise((resolve) => {
    console.log("promise return timestamp", performance.now());
    setTimeout(() => {
      client.isPlaying = false;
      resolve();
      console.log("promise resolved timestamp", performance.now());
    }, durationInSec * 1000);
  });
};

const getNextInQ = (q) => {
  if (q.length) {
    const nextSong = q.slice(0, 1)[0];
    console.log("getter of next song:", nextSong);
    return nextSong;
  } else {
    console.log("no queue length, cannot get next song in q");
  }
};

const normalizeLinks = (str) => {
  const regexp = /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=/g;
  const regexp2 = /https:\/\/(youtu\.be)/g;
  const rightRegexp = [...str.matchAll(regexp)].length ? regexp : regexp2;
  str.replaceAll(" ", "");
  const a = str.matchAll(rightRegexp); // spread operator mutates iterable variable, so dont do ...a
  const indexes = [];
  const res = [];
  for (const match of a) {
    indexes.push(match.index);
  }
  indexes.forEach((index, ii) => {
    res.push(str.slice(index, indexes[ii + 1]));
  });
  if ([...str.matchAll(regexp2)].length) {
    return res.map((link) => remapYtBeLink(link));
  }
  return res;
};

const remapYtBeLink = (ytBeLink) =>
  "https://www.youtube.com/watch?v=" +
  ytBeLink.slice(ytBeLink.lastIndexOf("/") + 1);

const createIdleListener = (client) => {
  if (!client.audioPlayer || !client.audioSubscription) return;
  client.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
    console.log("queue on idle listener", client.audioQueue);
    if (client.audioQueue.length > 0) {
      console.log(
        "idle status playing next song in q, current timestamp:",
        performance.now()
      );
      await playAudio(getNextInQ(client.audioQueue), client.audioPlayer);
    } else if (client.audioSubscription) {
      console.log(
        "no more songs in queue, unsubscribing and destroying connection"
      );
      disconnectClient(client);
    }
  });
  client.hasIdleListener = true;
};

const disconnectClient = (client) => {
  if (client.audioSubscription && client.audioConnection) {
    client.hasIdleListener = false;
    client.isPlaying = false;
    client.audioQueue = [];
    client.audioSubscription.unsubscribe();
    client.audioConnection.destroy();
    client.audioSubscription = null;
    client.audioConnection = null;
    client.audioPlayer = null;
  }
};
