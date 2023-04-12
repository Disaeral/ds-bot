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

const { token } = require("../config.json");

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
client.timeoutId = null;

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on(Events.MessageCreate, async (msg) => {
  switch (msg.content) {
    case msg.content.match(/https:\/\/www.youtube.com/)?.input:
      let singleSong = {};
      if (([...msg.content.matchAll(/https:\/\/www.youtube.com/g)]).length > 1) {
        // if got bundle of songs parse them and queue them
        const links = await Promise.all(normalizeLinks(msg.content).map(async (link) => {
          const { durationInSec } = (await play.video_basic_info(link))
            .video_details;
          console.log(client.audioQueue.length);
          return { audioUrl: link, durationInSec }
        }));
        client.audioQueue.push(...links)
        console.log(client.audioQueue, 'queue after links were mapped here');
      } else {
        const audioUrl = msg.content;
        const { durationInSec } = (await play.video_basic_info(audioUrl))
          .video_details;
        const song = { audioUrl, durationInSec };
        singleSong = song
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
        // this needs polishing - done
        console.log("already playing a song, adding to queue");
        client.audioQueue.push(singleSong);
        console.log("added, current queue:", client.audioQueue);
      } else if (singleSong.audioUrl) {
        console.log("no queue or is not playing, playing recieved url:", singleSong.audioUrl);
        await playAudio(singleSong, client.audioPlayer);
      } else {
        console.log(client.audioQueue)
        await playAudio(getNextInQ(client.audioQueue), client.audioPlayer);
      }

      client.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
        console.log("queue on idle listener", client.audioQueue, "playback state isPlaying: ",client.isPlaying);
        if (client.audioQueue.length > 0 && !client.isPlaying) {
          console.log("idle status playing next song in q, current timestamp:", performance.now());
          await playAudio(getNextInQ(client.audioQueue), client.audioPlayer);
        } else if (client.audioSubscription) {
          console.log("no more songs in queue, unsubscribing and destroying connection");
          client.audioSubscription.unsubscribe();
          client.audioConnection.destroy();
          client.audioSubscription = null;
          client.audioConnection = null;
          client.audioPlayer = null;
        }
      });
      break;
    case "skip": 
      console.log('got skip request, skipping...')
      if (client.audioSubscription) {
        console.log(
          "unsubscribing and destroying connection"
        );
        client.audioSubscription.unsubscribe();
        client.audioConnection.destroy();
        client.audioSubscription = null;
        client.audioConnection = null;
        client.audioPlayer = null;
      } else {
        console.log('no subscription, aborting...')
      }
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
  if (client.isPlaying) return
  const { audioUrl, durationInSec } = song;
  console.trace("play call");
  const stream = await play.stream(audioUrl);
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
  });
  player.play(resource);
  client.isPlaying = true;
  console.log('after play', client.isPlaying);
  if (client.audioQueue.length > 0) {
    client.audioQueue.shift();
  }
  if (client.timeoutId) {
    clearTimeout(client.timeoutId)
  }
  return new Promise((resolve, reject) => {
    client.timeoutId = setTimeout(() => {
      client.isPlaying = false
      console.trace('playback over in setTimeout, timestamp:', performance.now())
      resolve();
    }, durationInSec*1000)
  })
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
  str.replaceAll(" ", "");
  const a = str.matchAll(regexp);

  const indexes = [];
  const res = [];

  for (const match of a) {
    indexes.push(match.index);
  }

  indexes.forEach((index, ii) => {
    res.push(str.slice(index, indexes[ii + 1]));
  });
  return res;
};