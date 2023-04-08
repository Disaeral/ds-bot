// Require the necessary discord.js classes
const { Events, Client, GatewayIntentBits, Partials } = require("discord.js");
const {
  createAudioResource,
  StreamType,
  createAudioPlayer,
  VoiceConnectionStatus,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const { joinVoiceChannel } = require("@discordjs/voice");
const { exec } = require("youtube-dl-exec");
const play = require("play-dl");

const { token } = require("../config.json");

// const app = express();

// app.get('/', async ({ query }, response) => {
// 	const { code } = query;

// 	if (code) {
// 		try {
// 			const tokenResponseData = await request('https://discord.com/api/oauth2/token', {
// 				method: 'POST',
// 				body: new URLSearchParams({
// 					client_id: clientId,
// 					client_secret: clientSecret,
// 					code,
// 					grant_type: 'authorization_code',
// 					redirect_uri: `http://localhost:${port}`,
// 					scope: 'identify',
// 				}).toString(),
// 				headers: {
// 					'Content-Type': 'application/x-www-form-urlencoded',
// 				},
// 			});

// 			const oauthData = await tokenResponseData.body.json();
// 			console.log(oauthData);
// 		} catch (error) {
// 			// NOTE: An unauthorized token will not throw an error
// 			// tokenResponseData.statusCode will be 401
// 			console.error(error);
// 		}
// 	}

// 	return response.sendFile('index.html', { root: '.' });
// });

// app.listen(port, () => console.log(`App listening at http://localhost:${port}`));
// Create a new client instance
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

// When the client is ready, run this code (only once)
client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);

});

client.on(Events.MessageCreate, async (msg) => {
  switch (msg.content) {
    case msg.content.match(/https:\/\/www.youtube.com/)?.input:
      console.log("yt url recieved, getting video info...");
      const audioUrl = msg.content;
      const { durationInSec } = (await play.video_basic_info(audioUrl))
        .video_details;
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
        client.audioSubscription = client.audioConnection.subscribe(client.audioPlayer);
        console.log('player and connection created');
      }
      if (!client.audioPlayer) {
        client.audioPlayer = createAudioPlayer();
        client.audioSubscription = client.audioConnection.subscribe(client.audioPlayer);
        console.log('player created');
      }
      console.log('checking if already playing', client.isPlaying);
      if (client.isPlaying) { // this needs polishing - done
        console.log('already playing a song, adding to queue');
        client.audioQueue.push({audioUrl, durationInSec})
        console.log('added, current queue:', client.audioQueue);
      } else {
        console.log('no queue or is not playing, playing recieved url');
        await playAudio(audioUrl, client.audioPlayer);
      }

      client.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
        client.isPlaying = false
        console.log('queue on idle listener', client.audioQueue);
        if (client.audioQueue.length > 0) { // this causes play to be called too often
          console.log('idle status playing next song in q');
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
    default:
      console.log('non yt url message recieved:', msg.content);
  }
});



client.on(Events.Error, (e) => {
  console.error(e);
});
// // Login to Discord with your client's token
client.login(token);



const playAudio = async (url, player) => {
  console.trace('play call');
  const stream = await play.stream(url);
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
  });
  player.play(resource);
  client.isPlaying = true;
  if (client.audioQueue.length) {
    client.audioQueue.shift();
  }
};

const getNextInQ = (q) => {
  if (q.length) {
    const nextSong = q.slice(0, 1)[0].audioUrl
    console.log('getter of next song:', nextSong);
    return nextSong
  } else {
    console.log('no queue length, cannot get next song in q');
  }
}