/**
 * @name JAML
 * @author hash
 * @description Just Another Message Logger for better discord
 * @version 0.1
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
            `#logger-modal-window {
                display: none;
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
                background-color: var(--background-primary);
                border-radius: 0px 0px 7px 7px;
            }

            .logger-content-header {
                display: flex;
                width: 100%;
                background-color: var(--background-tertiary);
                height: 20px;
            }
            .logger-page {
                overflow: auto;
                max-height: 500px;
                padding: 10px;
            }
            .logger-page::-webkit-scrollbar {
                display: none;
            }

            .logger-button {
                background-color: var(--background-tertiary);
                color: var(--text-muted);
            }
            .logger-button:hover {
                background-color: var(--background-secondary);
            }
            .logger-input {
                width: 100%;
                border: none;
                background-color: var(--background-tertiary);
                color: var(--text-normal);
            }

            .logger-settings-field {
                margin-top: 10px;
                margin-bottom: 10px;
                padding: 10px;
                border-radius: 7px;
                color: var(--text-normal);
                background-color: var(--background-secondary);
            }
            .logger-message {
                background-color: var(--background-secondary);
                padding: 10px;
                margin: 10px;
                border-radius: 7px;
                color: var(--text-normal);
            }`
        );
    }

    stop() {
        this.destructHtml()
        BdApi.Patcher.unpatchAll("MessageLogger");
        BdApi.clearCSS("MessageLogger");
        BdApi.saveData("MessageLogger", "settings", this.settings);
    }


    /*================= HANDLERS START ======================*/
    onDelete(channelID, messageID) {
        const message = this.MessageStore.getMessage(channelID, messageID);
        if (message === undefined) return;
        const clearMessage = this.getClearMessage(message);
        if (!this.proceedCaching(clearMessage)) return;
        this.CachedMessages.push(clearMessage);
        BdApi.showToast(`message deleted ${clearMessage.guild.name}/${clearMessage.channel.name}`);
    }
    /*================== HANDLERS END =======================*/

    /*=================== MISC START ========================*/
    /*guild and channels can be stored in the separeted list */
    /*and clear message will hold only ids                   */
    /*for memory efficient (i think it works like this...)   */
    initHtml() {
        const mount = document.createElement("div");
        mount.id = "logger-mount";
        document.body.appendChild(mount);
        BdApi.ReactDOM.createRoot(document.getElementById("logger-mount")).render(React.createElement(ModalWindow));

        const menuBarNode = document.getElementsByClassName("tutorialContainer-1pL9QS")[0];
        const menuButton = React.createElement("button", {id: "logger-menu-button", class: "listItem-3SmSlK logger-button"}, "logger");
        menuButton.props.onClick = () => document.getElementById("logger-modal-window").style.display = "block";
        BdApi.ReactDOM.render(BdApi.ReactDOM.createPortal(menuButton, menuBarNode), document.createElement("div"));

        window.onclick = (e) => {
            const modalWindow = document.getElementById("logger-modal-window");
            if (e.target == modalWindow) modalWindow.style.display = "none";
        };
    }

    destructHtml() {
        document.getElementById("logger-mount").remove();
        document.getElementById("logger-menu-button").remove();
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

    proceedCaching(message) {
        return !this.settings.is_whitelist_used || (this.settings.whitelist.channels.includes(message.channel.id) || this.settings.whitelist.guilds.includes(message.guild.id));
    }
    /*===================  MISC END  ========================*/
};

/*=================== MENU START ========================*/
/*I don't know how to use js and react :/                */
/*so it's a big chunk of shit                            */
class ModalWindow extends React.Component {
    render() {
        return React.createElement(
            "div", {id: "logger-modal-window"},
            React.createElement(ModalContent)
        );
    }
}

class ModalContent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            page: "log"
        };
    }

    renderHeader() {
        const generateButton = (text) => React.createElement("button", {class: "logger-button", onClick: () => this.setState({page: text})}, text);

        return React.createElement("div", {class: "logger-content-header"}, 
                generateButton("log"),
                generateButton("settings"),
                generateButton("dump"),
                generateButton("load")
            )
    }

    renderPage(text) {
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

    render() {
        return React.createElement(
            "div",
            {id: "logger-modal-content"},
            this.renderHeader(),
            this.renderPage(this.state.page)
        );
    }
}

class LogPage extends React.Component {
    render() {
        const messages = BdApi.Plugins.get("JAML").instance.CachedMessages.slice().reverse().map(message => React.createElement(Message, {message}));
        return React.createElement("div", {class: "logger-page"}, messages);
    }
}

class SettingsPage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            settings: BdApi.Plugins.get("JAML").instance.settings
        };
    }

    componentWillUnmount() {
        const settings = {
            whitelist: {
                guilds: document.getElementById("logger-input-guilds").value?.split(",").map(channel => channel.trim()),
                channels: document.getElementById("logger-input-channels").value?.split(",").map(channel => channel.trim()),
            },
            is_whitelist_used: document.getElementById("logger-input-whitelist").textContent.includes("on") ? true : false
        };
        BdApi.Plugins.get("JAML").instance.settings = settings;
    }

    render() {
        const onWhiteListClick = () => {
            let settings = this.state.settings;
            settings.is_whitelist_used = !settings.is_whitelist_used;
            this.setState({settings});
        }

        return React.createElement("div", {class: "logger-page"},
            React.createElement("div", {class: "logger-settings-field"},
                React.createElement("label", {}, "guild whitelist: ",
                    React.createElement("input", {id: "logger-input-guilds", class: "logger-input", defaultValue: this.state.settings.whitelist.guilds}) 
                )
            ),
            React.createElement("div", {class: "logger-settings-field"},
                React.createElement("label", {}, "channel whitelist: ",
                    React.createElement("input", {id: "logger-input-channels", class: "logger-input", defaultValue: this.state.settings.whitelist.channels}) 
                )
            ),
            React.createElement("div", {class: "logger-settings-field"},
                React.createElement("label", {}, "whitelist enabled: ",
                    React.createElement("button", {id: "logger-input-whitelist", class: "logger-button", onClick: onWhiteListClick}, this.state.settings.is_whitelist_used ? "on" : "off") 
                )
            )
        );
    }
}

class Message extends React.Component {
    render() {
        const message = this.props.message;
        const header = React.createElement("div", {style: {marginBottom: "5px"}}, `${message?.author?.username} in ${message?.guild?.name}/${message?.channel?.name} (${new Date(message.time).toUTCString()})`);
        const content = React.createElement("div", {style: {marginBottom: "5px"}}, message.content);
        const attachments = message.attachments?.map(attachment => React.createElement(Attachment, {attachment}));

        return React.createElement("div", {class: "logger-message", id: `message-${message.id}`}, header, content, attachments);
    }
}

class Attachment extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            settings: {
                height: 200
            }
        }
    }

    renderMedia(attachment) {
        if (attachment?.type.includes("image")) {
            return React.createElement("img", {src: attachment?.url, height: this.state.settings.height});
        } else if (attachment?.type.includes("video")) {
            return React.createElement("video", {src: attachment?.url, height: this.state.settings.height, type: attachment.type, controls: true, muted: true});
        } else {
            return null;
        }
    }

    render() {
        const attachment = this.renderMedia(this.props.attachment);
        return React.createElement("a", {href: this.props.attachment?.url, style: {marginRight: "5px"}}, attachment);
    }
}

/*===================  MENU END  ========================*/
