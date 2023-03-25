/**
 * @name JAML
 * @author hash
 * @description Just Another Message Logger for better discord
 * @version 0.5
 * @authorId 305715782732480512
 * @invite MrmPVe43T5
 */

const { React } = BdApi;

module.exports = class MessageLogger {
    constructor(meta) {
        this.meta = meta;
        this.settings = this.getSettings();
        this.cachedMessages = new MessageCache();
    }

    start() {
        this.mountHtml();
        BdApi.Patcher.before(this.meta.name, DiscordModules.getInstance().Dispatch, "dispatch", (_, args, original) => {
            const dispatch = args[0];
            if (!dispatch) return;

            if (dispatch.type === "MESSAGE_UPDATE") {
                const message = this.cachedMessages.getOrCreate(dispatch.message.channel_id, dispatch.message.id);
                if (!message) return;
                // Converting tenor links to gif calls message_update event. I hate discord.
                if (message?.embeds?.length != dispatch?.message?.embeds?.length) return;

                message.content.push(dispatch.message.content);
                this.cachedMessages.updateCache(message)
                this.notify(message, "edited");
            }

            if (dispatch.type === "MESSAGE_DELETE") {
                const message = this.cachedMessages.getOrCreate(dispatch.channelId, dispatch.id);
                if (!message) return;
                const currentUser = DiscordModules.getInstance().UserStore.getCurrentUser();
                // Discord sends two events if the current user deletes a message. I hate discord.
                if(message?.author?.id === currentUser.id && Object.keys(dispatch).length === 4) return;

                this.cachedMessages.updateCache(message)
                this.notify(message, "deleted");
            }
        });
        BdApi.injectCSS(this.meta.name, 
            `#logger-modal-window{display:block;position:fixed;z-index:999;padding-top:10vh;left:0;top:0;width:100%;height:100%;overflow:auto;background-color:rgba(0,0,0,.7)}
            #logger-modal-content{margin:auto;width:80%;word-break:break-word;border-radius:0 0 7px 7px}.d-flex{display:flex}.row{flex-direction:row}.col{flex-direction:col}
            .bg-hover-tertiary:hover,.bg-tertiary{background-color:var(--background-tertiary)}.bg-hover-primary:hover,.bg-primary{background-color:var(--background-primary)}
            .bg-hover-secondary:hover,.bg-secondary{background-color:var(--background-secondary)}.c-normal{color:var(--text-normal)}.c-muted{color:var(--text-muted)}
            .logger-page{overflow:auto;max-height:75vh;padding:10px}.logger-page::-webkit-scrollbar{display:none}.logger-page-header{width:100%;height:20px}
            .logger-input{width:100%;border:none}.logger-settings-field{margin-top:10px;margin-bottom:10px;padding:10px;border-radius:7px}
            .logger-message-wrapper{padding:10px;margin:10px;border-radius:7px}.logger-message-avatar{width:2.5rem;height:2.5rem;border-radius:50%}
            .logger-message-content-wrapper{user-select:text!important;padding-left:1rem}.logger-message-content,.logger-message-header{margin-bottom:5px}`
        );
    }

    stop() {
        document.getElementById("logger-mount").remove();
        document.getElementById("logger-menu-button").remove();
        BdApi.Patcher.unpatchAll(this.meta.name);
        BdApi.clearCSS(this.meta.name);
        BdApi.saveData(this.meta.name, "settings", this.settings);
    }

    /*=================== MISC START ========================*/
    mountHtml() {
        const mount = document.createElement("div");
        mount.id = "logger-mount";
        document.body.appendChild(mount);

        const root = BdApi.ReactDOM.createRoot(document.getElementById("logger-mount"))

        const menuBarNode = document.getElementsByClassName("tutorialContainer-1pL9QS")[0];
        const menuButton = React.createElement("button", {id: "logger-menu-button", class: "listItem-3SmSlK bg-tertiary c-muted bg-hover-secondary"}, "logger"); 
        BdApi.ReactDOM.render(BdApi.ReactDOM.createPortal(menuButton, menuBarNode), document.createElement("div"));
        
        menuButton.props.onClick = () => {
            root.render(React.createElement(ModalWindow));
        };
        window.onclick = (e) => {
            if (e.target == document.getElementById("logger-modal-window")) root.render(null);
        };
    }

    getSettings() {
        const default_settings = {
            log_bot_messages: false,
            is_whitelist_used: false,
            whitelist: {
                channels: [],
                guilds: []
            }
        };
        return Object.assign({}, default_settings, BdApi.loadData(this.meta.name, "settings"));
    }

    notify(message, event) {
        if (!message?.guild?.id) {
            BdApi.showToast(`message ${event} DM/${message?.author?.username}`);
        } else {
            BdApi.showToast(`message ${event} ${message?.guild?.name}/${message?.channel?.name}`);
        }
    }
    /*===================  MISC END  ========================*/
};

class DiscordModules {
    static getInstance() {
        if (!DiscordModules.instance) DiscordModules.instance = new DiscordModules();
        return DiscordModules.instance;
    }

    constructor() {
        this.Dispatch = this.#getModuleByProps("dispatch", "subscribe");
        this.GuildStore = this.#getModuleByProps("getGuild", "getGuildCount");
        this.ChannelStore = this.#getModuleByProps("getChannel", "getDMFromUserId");
        this.MessageStore = this.#getModuleByProps("getMessages", "getMessage");
        this.UserStore = this.#getModuleByProps("getUsers", "getUser");
        DiscordModules.instance = this;
    }

    #getModuleByProps(...props) {
        const propsFilter = BdApi.Webpack.Filters.byProps(...props);
        return BdApi.Webpack.getModule(propsFilter, {first: true});
    }
}

class MessageCache {
    constructor() {
        this.cache = [];
    }

    proceedCaching(message) {
        // My idea was providing settings in the constructor in the main class (`MessageCache(this.settings)`)
        // but it clones the value instead of reference it, idk why.
        var settings = BdApi.Plugins.get("JAML").instance.settings;
        
        if (!settings.log_bot_messages && message?.author?.bot) return false;
        if (!settings.is_whitelist_used) return true;
      
        const idInGuilds = settings.whitelist.guilds.includes(message?.guild?.id);
        const idInChannels = settings.whitelist.channels.includes(message?.channel?.id);
      
        return idInGuilds || idInChannels;
    }

    getOrCreate(channelId, messageId) {
        var message = this.cache.find(m => m.id == messageId);
        if (!message) {
            message = DiscordModules.getInstance().MessageStore.getMessage(channelId, messageId);
            if (!message) return undefined;
            message = MessageCompressor.compress(message);
            if(!this.proceedCaching(message)) return undefined;
            this.cache.push(message);
        }
        return message;
    }

    updateCache(message) {
        const messageIndex = this.cache.findIndex(m => m.id == message.id);
        if (messageIndex > -1) this.cache.splice(messageIndex, 1);
        this.cache.push(message);
    }

    dump() {
        //todo
    }

    load() {
        //todo
    }
}

class MessageCompressor {
    static #tools = {
        getGuild: DiscordModules.getInstance().GuildStore.getGuild,
        getChannel: DiscordModules.getInstance().ChannelStore.getChannel,
        getUser: DiscordModules.getInstance().UserStore.getUser
    }
    
    static compress(message) {
        const channel = MessageCompressor.#tools.getChannel(message?.channel_id);
        const guild = MessageCompressor.#tools.getGuild(channel?.guild_id);
        
        return {
            guild: MessageCompressor.#compressGuild(guild),
            channel: MessageCompressor.#compressChannnel(channel),
            author: MessageCompressor.#compressAuthor(message?.author),
            attachments: MessageCompressor.#compressAttachments(message?.attachments),
            embeds: message?.embeds,
            content: [MessageCompressor.#replacePings(message?.content, guild?.roles)],
            id: message?.id,
            time: Date.now()
        };
    }

    static #compressGuild(guild) {
        if (!guild) return null;
        return {
            name: guild?.name,
            id: guild?.id
        };
    }

    static #compressChannnel(channel) {
        if (!channel) return null;
        return {
            name: channel?.name,
            id: channel?.id,
        };
    }

    static #compressAuthor(author) {
        if (!author) return null;
        return {
            username: author?.username,
            discriminator: author?.discriminator,
            id: author?.id,
            avatar_url: `https://cdn.discordapp.com/avatars/${author?.id}/${author?.avatar}.png?size=128`,
            bot: author?.bot
        };
    }

    static #compressAttachments(attachments) {
        if (!attachments) return null;
        return attachments.map(a => ({
            url: a.proxy_url,
            type: a.content_type,
            name: a.filename
        }));
    }

    static #replacePings(content, roles) {
        // Replaces the substring finded by the regex in the content with the findFn function.
        // Example: replace("test <@1234>", /<@[0-9]+>/ig, (id) => MessageTools.#tools.getUser(id)?.username) -> "test @username"
        const replace = (content, regexp, findFn) => {
            return content?.replaceAll(regexp, (ping) => {
                ping = ping?.replaceAll(/[<>]/ig, '');
                const id = ping?.match(/[0-9]+/);
                return ping?.replace(id, findFn(id));
            });
        };

        content = replace(content, /<#[0-9]+>/ig, (id) => MessageCompressor.#tools.getChannel(id)?.name);
        content = replace(content, /<@&[0-9]+>/ig, (id) => roles?.[id]?.name);
        content = replace(content, /<@[0-9]+>/ig, (id) => MessageCompressor.#tools.getUser(id)?.username);
        return content;
    }
}



/*=================== MENU START ========================*/
/*I don't know how to use js and react :/                */
/*so it's a big chunk of shit                            */
const ModalWindow = () => {
    return React.createElement("div", {id: "logger-modal-window"}, React.createElement(ModalContent));
}

const ModalContent = () => {
    const [page, setPage] = React.useState("log");

    function renderPage(text) {
        switch (text) {
            case "log":
                return React.createElement(LogPage)
            case "settings":
                return React.createElement(SettingsPage)
            case "dump":
                return React.createElement("div", {style: {color: "#FFFFFF", padding: "20px", "font-size": "18px"}}, "NIY")
            case "load":
                return React.createElement("div", {style: {color: "#FFFFFF", padding: "20px", "font-size": "18px"}}, "NIY")
        }
    }

    return React.createElement(
            "div", {id: "logger-modal-content", class: "bg-primary"},
            React.createElement("div", {class: "logger-page-header d-flex bg-tertiary"}, 
                React.createElement("button", {class: "bg-tertiary c-muted bg-hover-secondary", onClick: () => setPage("log")}, "log"),
                React.createElement("button", {class: "bg-tertiary c-muted bg-hover-secondary", onClick: () => setPage("settings")}, "settings"),
                React.createElement("button", {class: "bg-tertiary c-muted bg-hover-secondary", onClick: () => setPage("dump")}, "dump"),
                React.createElement("button", {class: "bg-tertiary c-muted bg-hover-secondary", onClick: () => setPage("load")}, "load")
            ),
            renderPage(page)
        );
}

const LogPage = () => {
    const messages = BdApi.Plugins.get("JAML").instance.cachedMessages.cache.slice().reverse();
    const messageList = messages.map(message => React.createElement(Message, {message}));

    return React.createElement("div", {class: "logger-page"}, messageList);
}

const SettingsPage = () => {
    const [guilds, setGuilds] = React.useState(BdApi.Plugins.get("JAML").instance.settings.whitelist.guilds);
    const [channels, setChannels] = React.useState(BdApi.Plugins.get("JAML").instance.settings.whitelist.channels);
    const [whitelist, setWhitelist] = React.useState(BdApi.Plugins.get("JAML").instance.settings.is_whitelist_used);
    const [logBotMessages, setLogBotMessages] = React.useState(BdApi.Plugins.get("JAML").instance.settings.log_bot_messages);

    function handleGuildsChange(e) {
        setGuilds(e.target.value.split(",").map(guild => guild.trim()));
    }

    function handleChannelsChange(e) {
        setChannels(e.target.value.split(",").map(channel => channel.trim()));
    }

    function handleWhitelistClick() {
        setWhitelist(!whitelist);
    }

    function handleLogBotMessages() {
        setLogBotMessages(!logBotMessages);
    }

    React.useEffect(() => {
        const settings = {
            whitelist: {
                guilds,
                channels
            },
            is_whitelist_used: whitelist,
            log_bot_messages: logBotMessages
        };
        BdApi.Plugins.get("JAML").instance.settings = settings;
    });

    return React.createElement("div", {class: "logger-page"},
        React.createElement("div", {class: "logger-settings-field bg-secondary c-normal"},
            React.createElement("label", {}, "guild whitelist: ",
                React.createElement("input", {class: "logger-input bg-tertiary c-normal", onChange: handleGuildsChange, defaultValue: guilds}) 
            )
        ),
        React.createElement("div", {class: "logger-settings-field bg-secondary c-normal"},
            React.createElement("label", {}, "channel whitelist: ",
                React.createElement("input", {class: "logger-input bg-tertiary c-normal", onChange: handleChannelsChange, defaultValue: channels}) 
            )
        ),
        React.createElement("div", {class: "logger-settings-field bg-secondary c-normal d-flex"},
            React.createElement("label", {class: "row", style: {"margin-right": "5px"}}, "whitelist: ",
                React.createElement("button", {class: "bg-secondary c-muted", onClick: handleWhitelistClick}, whitelist ? "on" : "off") 
            ),
            React.createElement("label", {class: "row"}, "log bot messages: ",
                React.createElement("button", {class: "bg-secondary c-muted", onClick: handleLogBotMessages}, logBotMessages ? "on" : "off") 
            )
        )
    );
}

const Message = ({message}) => {
    return React.createElement("div", {class: "logger-message-wrapper d-flex bg-secondary c-normal", key: `message-id-${message.id}`},
        React.createElement("img", {src: message?.author?.avatar_url, class: "logger-message-avatar col"}),
        React.createElement("div", {class: "logger-message-content-wrapper col"}, 
            React.createElement(MessageHeader, {userName: message?.author?.username, guildName: message?.guild?.name, channelName: message?.channel?.name, messageTime: message.time}),
            React.createElement(MessageText, {contents: message?.content}),
            message?.attachments?.map(attachment => React.createElement(MessageAttachment, {attachment}))
        )
    );
}

const MessageHeader = ({userName, guildName, channelName, messageTime}) => {
    function getPath() {
        if (!guildName) return `DM`;
        return `${guildName}/${channelName}`;
    }

    function getTimeString() {
        return new Date(messageTime).toUTCString();
    }

    return React.createElement("div", {class: "logger-message-header row"}, `${userName} in ${getPath()} (${getTimeString()})`);
}

const MessageText = ({contents}) => {
    //hueta...
    function replaceUrlsAndEmoji(content) {
        const urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        const emojiRegex = /<:[A-Za-z0-9]+:[0-9]+>/ig;

        return content?.split(" ").map(part => {
            if (urlRegex.test(part)) {
                return React.createElement("a", {href: part}, part + " ");
            } else if (emojiRegex.test(part)) {
                const emojiId = part.substring(0, part.length - 1).split(":")[2];
                return React.createElement("img", {src: `https://cdn.discordapp.com/emojis/${emojiId}`, height: "16px"});
            } else {
                return part + " ";
            }
        });
    }

    function getClass(isLast) {
        return (isLast) ? null : "c-muted";
    }

    return React.createElement("div", {class: "logger-messsage-content row"}, 
        contents.map((content, index) => {
            const isLast = index == contents.length - 1;
            return React.createElement("div", {class: getClass(isLast)}, replaceUrlsAndEmoji(content));
        })
    );
}

const MessageAttachment = ({attachment}) => {
    const ATTACHMENT_HEIGHT = 200;

    function renderMedia() {
        var media = null;
        if (attachment?.type.includes("image")) {
            media = React.createElement("img", {src: attachment?.url, height: ATTACHMENT_HEIGHT});
        } else if (attachment?.type.includes("video")) {
            media = React.createElement("video", {src: attachment?.url, height: ATTACHMENT_HEIGHT, type: attachment.type, controls: true, muted: true});
        }
        return media;
    }

    return React.createElement("a", {href: attachment?.url, style: {marginRight: "5px"}}, renderMedia());
}
/*===================  MENU END  ========================*/
