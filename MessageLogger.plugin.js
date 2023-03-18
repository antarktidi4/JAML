/**
 * @name JAML
 * @author hash
 * @description Just Another Message Logger for better discord
 * @version 0.2
 * @authorId 305715782732480512
 * @invite MrmPVe43T5
 */

const { React } = BdApi;

module.exports = class MessageLogger {
    constructor(meta) {
        this.Dispatch = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps("dispatch"), {first: true});
        this.MessageStore = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps("getMessages", "getMessage"), {first: true});
        this.ChannelStore = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps("getChannel", "getDMFromUserId"), {first: true});
        this.GuildStore = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps("getGuild", "getGuildCount"), {first: true});
     
        this.CachedMessages = [];
        this.settings = this.getSettings();
    }

    start() {
        this.initHtml();
        BdApi.Patcher.before("MessageLogger", this.Dispatch, "dispatch", (_, args, original) => {
            const dispatch = args[0];
            if (!dispatch) return;
            switch (dispatch.type) {
                case "MESSAGE_DELETE":
                    this.onDelete(dispatch.channelId, dispatch.id);
                    return;
                default:
                    return;
            }
        });
        BdApi.injectCSS("MessageLogger", 
            `
            #logger-modal-window {
                display: block;
                position: fixed;
                z-index: 999;
                padding-top: 10vh;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                overflow: auto;
                background-color: rgba(0,0,0,0.7);
            }
            #logger-modal-content {
                margin: auto;
                width: 80%;
                overflow-wrap: break-word;
                border-radius: 0px 0px 7px 7px;
            }

            .d-flex {
                display: flex;
            }
            .row {
                flex-direction: row;
            }
            .col {
                flex-direction: col;
            }
            
            .bg-tertiary {
                background-color: var(--background-tertiary);
            }
            .bg-primary {
                background-color: var(--background-primary);
            }
            .bg-secondary {
                background-color: var(--background-secondary);
            }
            .bg-hover-tertiary:hover {
                background-color: var(--background-tertiary);
            }
            .bg-hover-primary:hover {
                background-color: var(--background-primary);
            }
            .bg-hover-secondary:hover {
                background-color: var(--background-secondary);
            }

            .c-normal {
                color: var(--text-normal);
            }
            .c-muted {
                color: var(--text-muted);
            }

            .logger-page {
                overflow: auto;
                max-height: 500px;
                padding: 10px;
            }
            .logger-page::-webkit-scrollbar {
                display: none;
            }
            .logger-page-header {
                width: 100%;
                height: 20px;
            }

            .logger-input {
                width: 100%;
                border: none;
            }

            .logger-settings-field {
                margin-top: 10px;
                margin-bottom: 10px;
                padding: 10px;
                border-radius: 7px;
            }
            .logger-message-wrapper {
                padding: 10px;
                margin: 10px;
                border-radius: 7px;
            }
            .logger-message-avatar {
                width: 2.5rem;
                height: 2.5rem;
                border-radius: 50%;
            }
            .logger-message-content-wrapper {
                padding-left: 1rem;
            }
            .logger-message-header {
                margin-bottom: 5px;
            }
            .logger-message-content {
                margin-bottom: 5px;
            }
            `
        );
    }

    stop() {
        this.destructHtml()
        BdApi.Patcher.unpatchAll("MessageLogger");
        BdApi.clearCSS("MessageLogger");
        BdApi.saveData("MessageLogger", "settings", this.settings);
    }


    /*================= HANDLERS START ======================*/
    onDelete(channelId, messageId) {
        const message = this.MessageStore.getMessage(channelId, messageId);
        if (message === undefined) return;
        
        const clearMessage = this.getClearMessage(message);

        const proceedCaching = !this.settings.is_whitelist_used || (this.settings.whitelist.channels.includes(clearMessage?.channel?.id) || this.settings.whitelist.guilds.includes(clearMessage?.guild.id));
        if (!proceedCaching) return;
        this.CachedMessages.push(clearMessage);
        BdApi.showToast(`message deleted ${clearMessage?.guild?.name}/${clearMessage?.channel?.name}`);
    }
    /*================== HANDLERS END =======================*/

    /*=================== MISC START ========================*/
    initHtml() {
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
    
    destructHtml() {
        document.getElementById("logger-mount").remove();
        document.getElementById("logger-menu-button").remove();
    }

    getSettings() {
        const default_settings = {
            is_whitelist_used: false,
            whitelist: {
                channels: [],
                guilds: []
            }
        };
        return Object.assign({}, default_settings, BdApi.loadData("MessageLogger", "settings"));
    }

    getClearMessage(message) {
        const channel = this.ChannelStore.getChannel(message?.channel_id);
        const guild = this.GuildStore.getGuild(channel?.guild_id);
        return {
            guild: this.getClearGuild(guild),
            channel: this.getClearChannel(channel),
            author: this.getClearAuthor(message?.author),
            attachments: this.getClearAttachments(message?.attachments),
            content: message?.content,
            id: message?.id,
            time: Date.now()
        }
    }

    getClearGuild(guild) {
        if (!guild) return null;
        return {
            name: guild?.name,
            id: guild?.id
        }
    }

    getClearChannel(channel) {
        if (!channel) return null;
        return {
            name: channel?.name,
            id: channel?.id,
            guild_id: channel?.guild_id
        };
    }

    getClearAuthor(author) {
        if (!author) return null;
        return {
            username: author?.username,
            discriminator: author?.discriminator,
            bot: author?.bot,
            id: author?.id,
            avatar_url: `https://cdn.discordapp.com/avatars/${author?.id}/${author?.avatar}.png?size=128`
        };
    }

    getClearAttachments(attachment) {
        if (!attachment) return null;
        return attachment.map(a => ({
            url: a.proxy_url,
            type: a.content_type,
            name: a.filename
        }));
    }
    /*===================  MISC END  ========================*/
};

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
                return React.createElement("div", {style: {color: "#FFFFFF", padding: "20px"}}, "NIY")
            case "load":
                return React.createElement("div", {style: {color: "#FFFFFF", padding: "20px"}}, "NIY")
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
    const messages = BdApi.Plugins.get("JAML").instance.CachedMessages.slice().reverse();
    const messageList = messages.map(message => React.createElement(Message, {message}));

    return React.createElement("div", {class: "logger-page"}, messageList);
}

const SettingsPage = () => {
    const [guilds, setGuilds] = React.useState(BdApi.Plugins.get("JAML").instance.settings.whitelist.guilds);
    const [channels, setChannels] = React.useState(BdApi.Plugins.get("JAML").instance.settings.whitelist.channels);
    const [whitelist, setWhitelist] = React.useState(BdApi.Plugins.get("JAML").instance.settings.is_whitelist_used);

    function handleGuildsChange(e) {
        setGuilds(e.target.value.split(",").map(channel => channel.trim()));
    }

    function handleChannelsChange(e) {
        setChannels(e.target.value.split(",").map(channel => channel.trim()));
    }

    function handleWhitelistClick() {
        setWhitelist(!whitelist);
    }

    React.useEffect(() => {
        const settings = {
            whitelist: {
                guilds: guilds,
                channels: channels,
            },
            is_whitelist_used: whitelist
        };
        BdApi.Plugins.get("JAML").instance.settings = settings;
    });

    return React.createElement("div", {class: "logger-page"},
        React.createElement("div", {class: "logger-settings-field bg-secondary c-normal"},
            React.createElement("label", {}, "guild whitelist: ",
                React.createElement("input", {id: "logger-input-guilds", class: "logger-input bg-tertiary c-normal", onChange: handleGuildsChange, defaultValue: guilds}) 
            )
        ),
        React.createElement("div", {class: "logger-settings-field bg-secondary c-normal"},
            React.createElement("label", {}, "channel whitelist: ",
                React.createElement("input", {id: "logger-input-channels", class: "logger-input bg-tertiary c-normal", onChange: handleChannelsChange, defaultValue: channels}) 
            )
        ),
        React.createElement("div", {class: "logger-settings-field bg-secondary c-normal"},
            React.createElement("label", {}, "whitelist enabled: ",
                React.createElement("button", {id: "logger-input-whitelist", class: "bg-tertiary c-muted bg-hover-secondary", onClick: handleWhitelistClick}, whitelist ? "on" : "off") 
            )
        )
    );
}

const Message = ({message}) => {
    function linkify(text) {
        var urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        return text.replace(urlRegex, function(url) {
            return '<a href="' + url + '">' + url + '</a>';
        });
    }

    return React.createElement("div", {class: "logger-message-wrapper d-flex bg-secondary c-normal", key: `message-id-${message.id}`},
        React.createElement("img", {src: message?.author?.avatar_url, class: "logger-message-avatar col"}),
        React.createElement("div", {class: "logger-message-content-wrapper col"}, 
            React.createElement("div", {class: "logger-message-header row"}, `${message?.author?.username} in ${message?.guild?.name}/${message?.channel?.name} (${new Date(message.time).toUTCString()})`),
            React.createElement("div", {class: "logger-messsage-content row", dangerouslySetInnerHTML: {__html: linkify(message?.content)}}),
            message?.attachments?.map(attachment => React.createElement(Attachment, {attachment}))
        )
    );
}

const Attachment = ({attachment}) => {
    const height = 200;

    function renderMedia(attachment) {
        if (attachment?.type.includes("image")) {
            return React.createElement("img", {src: attachment?.url, height: height});
        } else if (attachment?.type.includes("video")) {
            return React.createElement("video", {src: attachment?.url, height: height, type: attachment.type, controls: true, muted: true});
        } else {
            return null;
        }
    }

    return React.createElement("a", {href: attachment?.url, style: {marginRight: "5px"}}, renderMedia(attachment))
}
/*===================  MENU END  ========================*/
