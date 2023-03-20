/**
 * @name JAML
 * @author hash
 * @description Just Another Message Logger for better discord
 * @version 0.3
 * @authorId 305715782732480512
 * @invite MrmPVe43T5
 */

const { React } = BdApi;

module.exports = class MessageLogger {
    constructor(meta) {
        this.Dispatch = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps("dispatch", "subscribe"), {first: true});
        this.MessageStore = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps("getMessages", "getMessage"), {first: true});
        this.ChannelStore = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps("getChannel", "getDMFromUserId"), {first: true});
        this.GuildStore = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps("getGuild", "getGuildCount"), {first: true});
        
        this.cachedMessages = [];
        this.settings = this.getSettings();
    }

    start() {
        this.initHtml();
        BdApi.Patcher.before("MessageLogger", this.Dispatch, "dispatch", (_, args, original) => {
            const dispatch = args[0];
            if (!dispatch) return;
            
            if (dispatch.type === "MESSAGE_UPDATE") {
                // TODO
                return;
            }

            if (dispatch.type === "MESSAGE_DELETE") {
                const message = this.MessageStore.getMessage(dispatch.channelId, dispatch.id);
                if (message === undefined) return;

                const compressedMessage = this.compressMessage(message);
                if (!this.proceedCaching(compressedMessage)) return;

                this.cachedMessages.push(compressedMessage);
                if (guildIsNone) {
                    BdApi.showToast(`message deleted DM/${compressedMessage?.author?.username}`);
                } else {
                    BdApi.showToast(`message deleted ${compressedMessage?.guild?.name}/${compressedMessage?.channel?.name}`);
                }
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
        document.getElementById("logger-mount").remove();
        document.getElementById("logger-menu-button").remove();
        BdApi.Patcher.unpatchAll("MessageLogger");
        BdApi.clearCSS("MessageLogger");
        BdApi.saveData("MessageLogger", "settings", this.settings);
    }

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

    getSettings() {
        const default_settings = {
            is_whitelist_used: false,
            whitelist: {
                channels: [],
                guilds: [],
                dm: []
            }
        };
        return Object.assign({}, default_settings, BdApi.loadData("MessageLogger", "settings"));
    }

    proceedCaching(compressedMessage) {
        const whitelistUsed = this.settings.is_whitelist_used;
        const idInChannels = this.settings.whitelist.channels.includes(compressedMessage?.channel?.id);
        const idInGuilds = this.settings.whitelist.guilds.includes(compressedMessage?.guild?.id);
        const idInDms = this.settings.whitelist.dm.includes(compressedMessage?.author?.id);
        const guildIsNone = compressedMessage?.guild?.id === undefined;

        return !whitelistUsed || ((idInChannels || idInGuilds) || (idInDms && guildIsNone));
    }

    compressMessage(message) {
        const channel = this.ChannelStore.getChannel(message?.channel_id);
        const guild   = this.GuildStore.getGuild(channel?.guild_id);

        const compressedGuild = !guild ? null : {
            name: guild?.name,
            id: guild?.id
        };

        const compressedChannel = !channel ? null : {
            name: channel?.name,
            id: channel?.id,
        };

        const compressedAuthor = !message?.author ? null : {
            username: message?.author?.username,
            discriminator: message?.author?.discriminator,
            id: message?.author?.id,
            avatar_url: `https://cdn.discordapp.com/avatars/${message?.author?.id}/${message?.author?.avatar}.png?size=128`
        };

        const compressedAttachments = !message?.attachments ? null : message.attachments.map(a => ({
            url: a.proxy_url,
            type: a.content_type,
            name: a.filename
        }));

        return {
            guild: compressedGuild,
            channel: compressedChannel,
            author: compressedAuthor,
            attachments: compressedAttachments,
            content: message?.content,
            id: message?.id,
            time: Date.now()
        };
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
    const messages = BdApi.Plugins.get("JAML").instance.cachedMessages.slice().reverse();
    const messageList = messages.map(message => React.createElement(Message, {message}));

    return React.createElement("div", {class: "logger-page"}, messageList);
}

const SettingsPage = () => {
    const [guilds, setGuilds] = React.useState(BdApi.Plugins.get("JAML").instance.settings.whitelist.guilds);
    const [channels, setChannels] = React.useState(BdApi.Plugins.get("JAML").instance.settings.whitelist.channels);
    const [dm, setDm] = React.useState(BdApi.Plugins.get("JAML").instance.settings.whitelist.dm);
    const [whitelist, setWhitelist] = React.useState(BdApi.Plugins.get("JAML").instance.settings.is_whitelist_used);

    function handleGuildsChange(e) {
        setGuilds(e.target.value.split(",").map(guild => guild.trim()));
    }

    function handleChannelsChange(e) {
        setChannels(e.target.value.split(",").map(channel => channel.trim()));
    }

    function handleDmChange(e) {
        setDm(e.target.value.split(",").map(dm => dm.trim()));
    }

    function handleWhitelistClick() {
        setWhitelist(!whitelist);
    }

    React.useEffect(() => {
        const settings = {
            whitelist: {
                guilds: guilds,
                channels: channels,
                dm: dm
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
            React.createElement("label", {}, "DM whitelist: ",
                React.createElement("input", {id: "logger-input-dm", class: "logger-input bg-tertiary c-normal", onChange: handleDmChange, defaultValue: dm}) 
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
    const ATTACHMENT_HEIGHT = 200;

    function renderAttachment(attachment) {
        var media = null;
        
        if (attachment?.type.includes("image")) {
            media = React.createElement("img", {src: attachment?.url, height: ATTACHMENT_HEIGHT});
        } else if (attachment?.type.includes("video")) {
            media = React.createElement("video", {src: attachment?.url, height: ATTACHMENT_HEIGHT, type: attachment.type, controls: true, muted: true});
        }

        return React.createElement("a", {href: attachment?.url, style: {marginRight: "5px"}}, media)
    }

    function renderContent(text) {
        const urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;

        return text.split(" ").map(part => {
            return urlRegex.test(part) ? React.createElement("a", {href: part}, part) : part + " "
        });
    }

    return React.createElement("div", {class: "logger-message-wrapper d-flex bg-secondary c-normal", key: `message-id-${message.id}`},
        React.createElement("img", {src: message?.author?.avatar_url, class: "logger-message-avatar col"}),
        React.createElement("div", {class: "logger-message-content-wrapper col"}, 
            React.createElement("div", {class: "logger-message-header row"}, `${message?.author?.username} in ${message?.guild?.name}/${message?.channel?.name} (${new Date(message.time).toUTCString()})`),
            React.createElement("div", {class: "logger-messsage-content row"}, renderContent(message?.content)),
            message?.attachments?.map(attachment => renderAttachment(attachment))
        )
    );
}
/*===================  MENU END  ========================*/
