require('dotenv').config();
const fs = require('fs');

// set minimal express server so azure doesn't timeout the webapp service
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('Discord bot is running');
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});

// setup discord client and required gatewaybits
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

discordClient.login(process.env.DALLE_BOT_DISCORD_TOKEN)

// setup openai package and set configuration
const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
  organization: process.env.OPENAI_ORGANIZATION,
  apiKey: process.env.OPENAI_TOKEN,
});

// function to open connection for openai api
const connect = () => {
  return openai = new OpenAIApi(configuration);
}

// friendly message to see bot is working correctly
discordClient.on("ready", () => {
  console.log(`Dalle bot is ready!`)
});

/* 
-----------------------------------------------------
check for command and respond
-----------------------------------------------------
*/

// function for submitting image request and getting response
const submitImage = async (text, user) => {
    try {
        connect()
        console.log(`${user} submitted dalle image prompt: '${text}', waiting for response...`)
        let response = await openai.createImage({
          prompt: text,
          n: 2,
          size: '1024x1024',
          response_format: 'url',
        })
        return response.data.data[0].url
    } catch (error) {
        logError(error);
        throw error;
    }
}
// TODO: do logic to accept size requests
// const small = '256x256'
// const medium = '512x512'
// const large = '1024x1024'

// TODO: logic for allowing # of responses submission (and removal of that text for submission)
discordClient.on('interactionCreate', async interaction => {
  // const openai = new OpenAIApi(configuration);
  if (!interaction.isCommand()) return;
  
  // get user info for logging and response
  const userId = interaction.user.id;
  const userMention = `<@${userId}>`;
  const userAvatar = interaction.user.avatarURL();

  if (interaction.commandName === 'dalle') {

    try {
        // Defer the reply so we can do some async work before responding
        await interaction.deferReply({ 
            ephemeral: true 
        });
        // initial response to user
        await interaction.followUp({ 
            content: 'Dalle images responds a little slow (but much faster than Craiyon), so it may take a few seconds to populate. Just be patient! The bot will respond (and @ you) when it is complete', 
            ephemeral: true 
        });

        // Retrieve the text option value
        const inputText = interaction.options.getString('prompt');

        //process the command
        const imageUrl = await submitImage(inputText, interaction.user.username)

        // Create the embed from the dalle response
        const imageEmbed = new EmbedBuilder()
            .setDescription(`${inputText}`)
            .setImage(imageUrl)
            // TODO: handle when a user doesn't have a nickname, so it doesn't show null
            .setFooter({
                text:`Requested by ${interaction.member.nickname} (${interaction.user.username})`, 
                iconURL: `${userAvatar}`
            });

        // final response to channel and user with image
        await interaction.followUp({
            content: `${userMention}, here's your image:`, 
            embeds: [imageEmbed]
        });
    } catch (error) {
        await interaction.followUp({
            content: `${userMention}, there was an error processing your request. Please try again.`,
            ephemeral: true,
        })
        logError(error);
        throw error;
    }
  };
});

// function to log errors to file
function logError(error) {
    const logDirectory = 'logs';
    const logFile = `${logDirectory}/error.log`;

    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory);
    }

    const timestamp = new Date().toISOString();
    const errorMessage = `${timestamp} - ${error.message} - ${JSON.stringify(error)}`;

    fs.appendFile(logFile, errorMessage, (err) => {
        if (err) {
            console.error(`Failed to write to log file: ${err.message}`);
        }
    });
}