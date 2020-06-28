import TdLibController from '../../Controllers/TdLibController';
import React, { Component } from 'react';
import { NOTIFICATION_AUTO_HIDE_DURATION_MS } from '../../Constants';
import IconButton from '@material-ui/core/IconButton';
import NotificationTimer from '../Additional/NotificationTimer';
import Button from '@material-ui/core/Button';
import SupergroupStore from '../../Stores/SupergroupStore';
import ChatStore from '../../Stores/ChatStore';
import UserStore from '../../Stores/UserStore';
import { withSnackbar } from 'notistack';

async function sleep(ms = 0) {
    return new Promise(r => setTimeout(r, ms));
}

function showMessage(text, props) {
    const { enqueueSnackbar, classes } = props;
    if (!enqueueSnackbar) return;

    const TRANSITION_DELAY = 150;

    enqueueSnackbar(text, {
        autoHideDuration: NOTIFICATION_AUTO_HIDE_DURATION_MS - 2 * TRANSITION_DELAY,
        action: [
            <IconButton key='progress' color='inherit' className='progress-button'>
                <NotificationTimer timeout={NOTIFICATION_AUTO_HIDE_DURATION_MS} />
            </IconButton>,
            <Button key='undo' color='primary' size='small'>
                OK
            </Button>
        ]
    });
}

class EnhancedAction extends Component {
    constructor(props) {
        super(props);
    }

    async isChatAdmin(chatId, myUserId) {
        let isAdmin = false;
        await TdLibController.send({
            '@type': 'getChatMember',
            chat_id: chatId,
            user_id: myUserId
        }).then(result => {
            if (result.status['@type'] === 'chatMemberStatusCreator') {
                isAdmin = true;
            }
            if (result.status['@type'] === 'chatMemberStatusAdministrator') {
                isAdmin = true;
            }
        });
        return isAdmin;
    }

    async checkDeletePermission(chatId, myUserId) {
        let canDelete = false;
        await TdLibController.send({
            '@type': 'getChatMember',
            chat_id: chatId,
            user_id: myUserId
        }).then(result => {
            if (result.status['@type'] === 'chatMemberStatusCreator') {
                canDelete = true;
            }
            if (result.status['@type'] === 'chatMemberStatusAdministrator') {
                if (result.status.can_delete_messages) {
                    canDelete = true;
                }
            }
        });
        return canDelete;
    }

    async checkRestrictPermission(chatId, myUserId) {
        let canRestrict = false;
        await TdLibController.send({
            '@type': 'getChatMember',
            chat_id: chatId,
            user_id: myUserId
        }).then(result => {
            if (result.status['@type'] === 'chatMemberStatusCreator') {
                canRestrict = true;
            }
            if (result.status['@type'] === 'chatMemberStatusAdministrator') {
                if (result.status.can_restrict_members) {
                    canRestrict = true;
                }
            }
        });
        return canRestrict;
    }

    async getLastMessageID(chatId) {
        let last_msg_id = 0;
        await TdLibController.send({
            '@type': 'getChat',
            chat_id: chatId
        }).then(result => {
            if (typeof result.last_message !== 'undefined') {
                last_msg_id = result.last_message.id;
            }
        });
        return last_msg_id;
    }

    async getLastMessageUser(chatId) {
        let last_message_user = 0;
        await TdLibController.send({
            '@type': 'getChat',
            chat_id: chatId
        }).then(result => {
            if (typeof result.last_message !== 'undefined') {
                last_message_user = result.last_message.sender_user_id;
            }
        });
        return last_message_user;
    }

    async getSuperGroupMembers(supergroup_id) {
        let members = [];
        await TdLibController.send({
            '@type': 'getSupergroupMembers',
            supergroup_id: supergroup_id,
            filter: {
                '@type': 'supergroupMembersFilterRecent'
            },
            offset: 0,
            limit: 200
        }).then(result => {
            members = result.members;
        });
        return members;
    }

    async getChatAdmin(chatId) {
        let admins = [];
        await TdLibController.send({
            '@type': 'getChatAdministrators',
            chat_id: chatId
        }).then(result => {
            admins = result.user_ids;
        });
        return admins;
    }

    async removeChatMember(chatId, userId) {
        let ok = false;
        await TdLibController.send({
            '@type': 'setChatMemberStatus',
            chat_id: chatId,
            user_id: userId,
            status: {
                '@type': 'chatMemberStatusBanned',
                banned_until_date: Math.floor(Date.now() / 1000) + 60
            }
        }).then(() => {
            ok = true;
        });
        return ok;
    }

    async getBasicGroupFullInfo(basic_group_id) {
        let fullInfo = {};
        await TdLibController.send({
            '@type': 'getBasicGroupFullInfo',
            basic_group_id: basic_group_id
        }).then(result => {
            fullInfo = result;
        });
        return fullInfo;
    }

    async searchUserMessages(chatId, userId) {
        return await TdLibController.send({
            '@type': 'searchChatMessages',
            chat_id: chatId,
            query: '',
            sender_user_id: userId,
            from_message_id: 0,
            offset: 0,
            limit: 100,
            filter: null
        });
    }

    async deleteBasicGroupMessages(chatId) {
        while (true) {
            let last_message_user = await this.getLastMessageUser(chatId);

            if (last_message_user === 0) {
                break;
            }

            let msgs = [];
            let result = await this.searchUserMessages(chatId, last_message_user);

            for (let msg of result.messages) {
                msgs.push(msg.id);
            }

            if (msgs.length > 0) {
                TdLibController.send({
                    '@type': 'deleteMessages',
                    chat_id: chatId,
                    message_ids: msgs,
                    revoke: true
                });
            }
            await sleep(1000);
        }
    }

    deleteUserMessages = async (chatId, chatType, myUserId, sId, props) => {
        let canDelete = await this.checkDeletePermission(chatId, myUserId);

        if (!canDelete && sId !== myUserId) {
            showMessage('You do not have delete messages permission!', props);
            return false;
        }

        if (chatType === 'chatTypeSupergroup' && canDelete) {
            TdLibController.send({ '@type': 'deleteChatMessagesFromUser', chat_id: chatId, user_id: sId });
        }
        if ((chatType === 'chatTypeBasicGroup' && canDelete) || myUserId === sId) {
            while (true) {
                let total = 0;
                const nextTick = async () => {
                    let msgs = [];

                    let result = await this.searchUserMessages(chatId, sId);
                    let isSg = chatType === 'chatTypeSupergroup';
                    for (let msg of result.messages) {
                        if (
                            (msg.content['@type'] === 'messageChatAddMembers' && isSg && !canDelete) ||
                            (msg.content['@type'] === 'messageChatJoinByLink' && isSg && !canDelete) ||
                            (msg.content['@type'] === 'messageChatDeleteMember' && isSg && !canDelete)
                        ) {
                            continue;
                        }
                        msgs.push(msg.id);
                    }
                    if (msgs.length > 0) {
                        TdLibController.send({
                            '@type': 'deleteMessages',
                            chat_id: chatId,
                            message_ids: msgs,
                            revoke: true
                        });
                    }
                    return result.total_count;
                };

                total = await nextTick();
                if (total < 100) {
                    break;
                }
                await sleep(1000);
            }
        }
        showMessage('All of your/specific user messages is deleted!', props);
    };

    deleteAllMessages = async (chatId, chatType, myUserId, props) => {
        let canDelete = await this.checkDeletePermission(chatId, myUserId);

        if (!canDelete) {
            showMessage('You do not have delete messages permission!', props);
            return false;
        }

        const chat = ChatStore.get(chatId);

        if (chat.type['@type'] === 'chatTypeSupergroup') {
            let last_msg_id = await this.getLastMessageID(chatId);

            if (last_msg_id === 1048576) {
                let fullInfo = SupergroupStore.getFullInfo(chat.type.supergroup_id);
                if (fullInfo.upgraded_from_basic_group_id !== 0) {
                    showMessage('Seems this group was upgraded from Basic Group.', props);
                    showMessage('Deleting Basic Group chat history...Please wait a moment.', props);
                    await this.deleteBasicGroupMessages(
                        fullInfo.upgraded_from_basic_group_id -
                            fullInfo.upgraded_from_basic_group_id -
                            fullInfo.upgraded_from_basic_group_id
                    );
                }
            }

            if (last_msg_id === 0) {
                showMessage('This chat do not have any messages!', props);
                return false;
            }

            let m_id = last_msg_id / 1024 / 1024;

            let deleteMsgs = [];
            for (let i = m_id; i > 1; i--) {
                deleteMsgs.push(i * 1024 * 1024);
            }

            if (deleteMsgs.length !== 0) {
                TdLibController.send({
                    '@type': 'deleteMessages',
                    chat_id: chatId,
                    message_ids: deleteMsgs,
                    revoke: true
                });
            }
        } else if (chat.type['@type'] === 'chatTypeBasicGroup') {
            await this.deleteBasicGroupMessages(chatId);
        }

        showMessage('All group/channel messages removed!', props);
    };

    removeAllMembers = async (chat, myUserId, props) => {
        let canRestrict = await this.checkRestrictPermission(chat.id, myUserId);

        if (!canRestrict) {
            showMessage('You do not have ban users permission!', props);
            return false;
        }

        if (chat.type['@type'] === 'chatTypeSupergroup') {
            const fullInfo = SupergroupStore.getFullInfo(chat.type.supergroup_id);

            if (fullInfo.member_count === fullInfo.administrator_count) {
                showMessage('All group/channel members removed!', props);
                return true;
            }

            let total = fullInfo.member_count - fullInfo.administrator_count;
            while (true) {
                if (total === 0) {
                    break;
                }

                let members = await this.getSuperGroupMembers(chat.type.supergroup_id);

                if (members.length === fullInfo.administrator_count) {
                    break;
                }

                for (let member of members) {
                    if (
                        member.user_id === myUserId ||
                        member.status['@type'] === 'chatMemberStatusAdministrator' ||
                        member.status['@type'] === 'chatMemberStatusCreator'
                    ) {
                        continue;
                    }

                    let ok = await this.removeChatMember(chat.id, member.user_id);
                    if (ok) {
                        total--;
                        if (total % 50) {
                            showMessage(
                                'Removing group/channel members...' +
                                    total +
                                    '/' +
                                    (fullInfo.member_count - fullInfo.administrator_count),
                                props
                            );
                        }
                    }

                    await sleep(100);
                }
            }
        } else if (chat.type['@type'] === 'chatTypeBasicGroup') {
            const fullInfo = await this.getBasicGroupFullInfo(chat.type.basic_group_id);
            let admins = await this.getChatAdmin(chat.id);

            if (admins.length === fullInfo.members.length) {
                showMessage('All group members removed!', props);
                return true;
            }

            let total = fullInfo.members.length - admins.length;
            while (true) {
                if (total === 0) {
                    break;
                }

                let info = await this.getBasicGroupFullInfo(chat.type.basic_group_id);

                for (let member of info.members) {
                    if (
                        member.user_id === myUserId ||
                        member.status['@type'] === 'chatMemberStatusAdministrator' ||
                        member.status['@type'] === 'chatMemberStatusCreator'
                    ) {
                        continue;
                    }

                    let ok = await this.removeChatMember(chat.id, member.user_id);
                    if (ok) {
                        total--;
                        if (total % 50) {
                            showMessage(
                                'Removing group members...' + total + '/' + (fullInfo.member_count - admins.length),
                                props
                            );
                        }
                    }

                    await sleep(100);
                }
            }
        }
        showMessage('All group members removed!', props);
    };

    async CreateUserList(user_id) {
        let entity = '';
        await TdLibController.send({
            '@type': 'getUser',
            user_id: user_id
        }).then(result => {
            if (result.type['@type'] === 'userTypeRegular') {
                if (result.username) {
                    entity = '@' + result.username + '\n';
                } else {
                    entity =
                        '<a href="tg://user?id=' +
                        result.id +
                        '">' +
                        result.first_name +
                        ' ' +
                        result.last_name +
                        '</a>\n';
                }
            }
        });
        return entity;
    }

    tagAdmin = async (chatId, replyToMessageId, props) => {
        let result = await TdLibController.send({
            '@type': 'getChatAdministrators',
            chat_id: chatId
        });

        let list = '';
        for (let user of result.administrators) {
            list += await this.CreateUserList(user.user_id);
        }

        let parsedEntities = await TdLibController.send({
            '@type': 'parseTextEntities',
            text: list,
            parse_mode: {
                '@type': 'textParseModeHTML'
            }
        });

        const content = {
            '@type': 'inputMessageText',
            text: parsedEntities,
            disable_web_page_preview: false,
            clear_draft: true
        };

        TdLibController.send({
            '@type': 'sendMessage',
            chat_id: chatId,
            reply_to_message_id: replyToMessageId,
            input_message_content: content
        });
    };

    tagEveryone = async (chatId, replyToMessageId, props) => {
        let isAdmin = await this.isChatAdmin(chatId, UserStore.getMyId());

        if (!isAdmin) {
            showMessage('Only group admin can @everyone!', props);
            return;
        }

        const chat = ChatStore.get(chatId);
        let list = '';

        if (chat.type['@type'] === 'chatTypeBasicGroup') {
            const fullInfo = await this.getBasicGroupFullInfo(chat.type.basic_group_id);

            if (fullInfo.members.length > 100) {
                showMessage('@everyone can used at (<=)100 users group only!', props);
                return;
            }

            for (let user of fullInfo.members) {
                list += await this.CreateUserList(user.user_id);
            }
        } else if (chat.type['@type'] === 'chatTypeSupergroup') {
            const sg = await TdLibController.send({
                '@type': 'getSupergroupMembers',
                supergroup_id: chat.type.supergroup_id,
                filter: {
                    '@type': 'supergroupMembersFilterRecent'
                },
                offset: 0,
                limit: 31
            });

            if (sg.members.length > 30) {
                showMessage('@everyone can used at (<=)30 users group only!', props);
                return;
            }

            for (let user of sg.members) {
                list += await this.CreateUserList(user.user_id);
            }
        }

        let parsedEntities = await TdLibController.send({
            '@type': 'parseTextEntities',
            text: list,
            parse_mode: {
                '@type': 'textParseModeHTML'
            }
        });

        const content = {
            '@type': 'inputMessageText',
            text: parsedEntities,
            disable_web_page_preview: false,
            clear_draft: true
        };

        TdLibController.send({
            '@type': 'sendMessage',
            chat_id: chatId,
            reply_to_message_id: replyToMessageId,
            input_message_content: content
        });
    };
}

const enhancedAction = new EnhancedAction();
window.enhancedAction = enhancedAction;
export default enhancedAction;
