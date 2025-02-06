require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");
const fs = require("fs");

let prefixes = {};
const PREFIX_FILE = "prefixes.json";

if (fs.existsSync(PREFIX_FILE)) {
  prefixes = JSON.parse(fs.readFileSync(PREFIX_FILE));
}

const DEFAULT_PREFIX = "!";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: ["CHANNEL"],
});

client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}!`);
  registerSlashCommands();
});

function savePrefixes() {
  fs.writeFileSync(PREFIX_FILE, JSON.stringify(prefixes, null, 2));
}

async function registerSlashCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("remind")
      .setDescription("Set a reminder")
      .addStringOption((option) =>
        option
          .setName("input")
          .setDescription(
            "Time in minutes followed by the reminder message (e.g., '5 sleep')",
          )
          .setRequired(true),
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("help")
      .setDescription("Show available commands")
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    console.log("✅ Slash commands registered globally.");
  } catch (error) {
    console.error("❌ Failed to register slash commands:", error);
  }
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "remind") {
    const input = interaction.options.getString("input").trim();
    const args = input.split(" ");
    const time = parseInt(args[0]);
    const reminderMessage = args.slice(1).join(" ");

    if (isNaN(time) || time <= 0 || !reminderMessage) {
      return interaction.reply({
        content: "❌ Incorrect usage! Try: `/remind 5 sleep`",
        ephemeral: true,
      });
    }

    await interaction.reply(`✅ Reminder set for **${time} minute(s)**.`);

    setTimeout(
      async () => {
        try {
          await interaction.user.send(`⏰ **Reminder:** ${reminderMessage}`);
        } catch (error) {
          console.error("Failed to send DM:", error);
        }
      },
      time * 60 * 1000,
    );
  }

  if (interaction.commandName === "help") {
    await interaction.reply({
      content:
        "**📜 Available Commands:**\n" +
        "🔹 `/remind <time> <message>` - Set a reminder (e.g., `/remind 5 sleep`)\n" +
        "🔹 `/help` - Show this help message\n\n" +
        "**Prefix Commands:**\n" +
        "🔹 `!rm <time> <message>` - Set a reminder (e.g., `!rm 5 sleep`)\n" +
        "🔹 `!help` - Show this help message",
      ephemeral: true,
    });
  }
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const guildId = msg.guild ? msg.guild.id : null;
  const prefix =
    guildId && prefixes[guildId] ? prefixes[guildId] : DEFAULT_PREFIX;

  if (msg.content.startsWith(`${prefix}setprefix`)) {
    if (!msg.member.permissions.has("Administrator")) {
      return msg.reply(
        "❌ You need administrator permissions to change the prefix.",
      );
    }

    const newPrefix = msg.content.split(" ")[1];
    if (!newPrefix) {
      return msg.reply("Please provide a new prefix. Example: `!setprefix ?`");
    }

    prefixes[guildId] = newPrefix;
    savePrefixes();

    return msg.reply(`✅ Prefix changed to **${newPrefix}**`);
  }

  if (msg.content === `${prefix}ping`) {
    msg.reply("pong");
  }

  if (msg.content.startsWith(`${prefix}rm`)) {
    const args = msg.content.split(" ");
    const time = parseInt(args[1]);
    const reminderMessage = args.slice(2).join(" ");

    if (isNaN(time) || time <= 0) {
      return msg.reply(
        "Please specify a valid time in minutes. Example: `!rm 5 Take a break!`",
      );
    }

    if (!reminderMessage) {
      return msg.reply(
        "Please provide a reminder message. Example: `!rm 10 Stretch your legs!`",
      );
    }

    msg.reply(`✅ Reminder set for **${time} minute(s)**.`);

    setTimeout(
      async () => {
        try {
          await msg.author.send(`⏰ **Reminder:** ${reminderMessage}`);
        } catch (error) {
          console.error("Failed to send DM:", error);
          msg.reply(
            "I couldn't send you a DM. Make sure your DMs are enabled.",
          );
        }
      },
      time * 60 * 1000,
    );
  }

  if (msg.content === `${prefix}help`) {
    msg.reply(
      "**📜 Available Commands:**\n" +
        "🔹 `!rm <time> <message>` - Set a reminder (e.g., `!rm 5 sleep`)\n" +
        "🔹 `!help` - Show this help message\n\n" +
        "**Slash Commands:**\n" +
        "🔹 `/remind <time> <message>` - Set a reminder (e.g., `/remind 5 sleep`)\n" +
        "🔹 `/help` - Show this help message",
    );
  }
});

client.login(process.env.TOKEN);
