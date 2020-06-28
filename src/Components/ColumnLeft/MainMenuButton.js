/*
 *  Copyright (c) 2018-present, Evgeny Nadymov
 *
 * This source code is licensed under the GPL v.3.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { withTranslation } from 'react-i18next';
import IconButton from '@material-ui/core/IconButton';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import SpeedDialIcon from '@material-ui/lab/SpeedDialIcon';
import ArrowBackIcon from '../../Assets/Icons/Back';
import ChannelIcon from '../../Assets/Icons/Channel';
import CloseIcon from '../../Assets/Icons/Close';
import ArchiveIcon from '../../Assets/Icons/Archive';
import SearchIcon from '../../Assets/Icons/Search';
import MenuIcon from '../../Assets/Icons/Menu';
import GroupIcon from '../../Assets/Icons/Group';
import HelpIcon from '../../Assets/Icons/Help';
import SavedIcon from '../../Assets/Icons/Saved';
import SettingsIcon from '../../Assets/Icons/Settings';
import UserIcon from '../../Assets/Icons/User';
import { isAuthorizationReady } from '../../Utils/Common';
import { openArchive, openChat, searchChat } from '../../Actions/Client';
import AppStore from '../../Stores/ApplicationStore';
import CacheStore from '../../Stores/CacheStore';
import UserStore from '../../Stores/UserStore';
import TdLibController from '../../Controllers/TdLibController';
import Dialog from '@material-ui/core/Dialog';
import './MainMenuButton.css';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogActions from '@material-ui/core/DialogActions';
import { NOTIFICATION_AUTO_HIDE_DURATION_MS, WASM_FILE_HASH, WASM_FILE_NAME } from '../../Constants';
import NotificationTimer from '../Additional/NotificationTimer';
import { withSnackbar } from 'notistack';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import FormHelperText from '@material-ui/core/FormHelperText';
import { compose } from '../../Utils/HOC';

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

class SetLocalPasscodeDialog extends React.Component {
    state = {
        error: null
    };

    handleChangePC = event => {
        this.enteredPasscode = event.target.value;
    };

    handleChangePC2 = event => {
        this.enteredPasscode2 = event.target.value;
    };

    handleSave = async event => {
        if (!this.enteredPasscode) {
            this.setState({ error: { string: 'Local passcode cannot be empty.' } });
            return;
        }

        if (!this.enteredPasscode2) {
            this.setState({ error: { string: 'Please re-enter local passcode.' } });
            return;
        }

        if (this.enteredPasscode !== this.enteredPasscode2) {
            this.setState({ error: { string: 'Passcode not match. Please try again.' } });
            return;
        }

        await TdLibController.send({
            '@type': 'setDatabaseEncryptionKey',
            new_encryption_key: btoa(this.enteredPasscode)
        })
            .then(result => {
                this.props.onClose(true);
            })
            .catch(error => {
                this.setState({ error: { string: error.message } });
            });
    };

    render() {
        const { onClose, ...other } = this.props;
        const { error } = this.state;

        let errorString = '';
        if (error) {
            const { string } = error;
            errorString = string;
        }

        return (
            <Dialog
                transitionDuration={0}
                onClose={() => onClose(false)}
                aria-labelledby='delete-dialog-title'
                {...other}>
                <DialogTitle id='delete-dialog-title'>Local Passcode</DialogTitle>
                <DialogContent>
                    <div className='delete-dialog-content'>
                        <DialogContentText id='delete-dialog-description'>
                            Note: if you forget your local passcode, you'll need to relogin in Trashgram.
                        </DialogContentText>
                    </div>
                </DialogContent>
                <TextField
                    autoFocus
                    margin='normal'
                    id='passcode'
                    placeholder='Enter new passcode'
                    type='password'
                    contentEditable
                    suppressContentEditableWarning
                    onChange={this.handleChangePC}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                />
                <TextField
                    autoFocus
                    margin='normal'
                    id='passcode2'
                    placeholder='Re-enter new passcode'
                    type='password'
                    contentEditable
                    suppressContentEditableWarning
                    onChange={this.handleChangePC2}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                />
                <FormHelperText
                    id='sign-in-error-text'
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {errorString}
                </FormHelperText>
                <DialogActions>
                    <Button onClick={() => onClose(false)} color='primary'>
                        Cancel
                    </Button>
                    <Button onClick={this.handleSave} color='primary' autoFocus>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

class CreateSupergroupDialog extends React.Component {
    state = {
        error: null
    };

    handleTitle = event => {
        this.enteredTitle = event.target.value;
    };

    handleDesc = event => {
        this.enteredDesc = event.target.value;
    };

    handleCreate = async event => {
        if (!this.enteredTitle) {
            this.setState({ error: { string: 'Group title cannot be empty.' } });
            return;
        }

        let title = this.enteredTitle || '';
        if (title.length > 128) {
            this.setState({ error: { string: 'Group title too long. (Limit: 128 characters)' } });
            return;
        }

        let desc = this.enteredDesc || '';
        if (desc.length > 255) {
            this.setState({ error: { string: 'Group description too long. (Limit: 255 characters)' } });
            return;
        }

        await TdLibController.send({
            '@type': 'createNewSupergroupChat',
            title: title,
            is_channel: false,
            description: desc
        })
            .then(result => {
                this.props.onClose(true);
            })
            .catch(error => {
                this.setState({ error: { string: error.message } });
            });
    };

    render() {
        const { onClose, ...other } = this.props;
        const { error } = this.state;

        let errorString = '';
        if (error) {
            const { string } = error;
            errorString = string;
        }

        return (
            <Dialog
                transitionDuration={0}
                onClose={() => onClose(false)}
                aria-labelledby='delete-dialog-title'
                {...other}>
                <DialogTitle id='delete-dialog-title' style={{ width: '500px' }}>
                    Create New Supergroup
                </DialogTitle>
                <TextField
                    autoFocus
                    margin='normal'
                    id='title'
                    label='Enter group title'
                    type='text'
                    inputProps={{ maxLength: 128 }}
                    contentEditable
                    suppressContentEditableWarning
                    onChange={this.handleTitle}
                    style={{ width: '90%', margin: '0 auto' }}
                />
                <DialogContent />
                <TextField
                    autoFocus
                    margin='normal'
                    id='desc'
                    label='Enter group description(Optional)'
                    type='text'
                    maxLength='255'
                    multiline='true'
                    inputProps={{ maxLength: 255 }}
                    contentEditable
                    suppressContentEditableWarning
                    onChange={this.handleDesc}
                    style={{ width: '90%', margin: '0 auto' }}
                />
                <FormHelperText
                    id='sign-in-error-text'
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        color: 'red'
                    }}>
                    {errorString}
                </FormHelperText>
                <DialogActions>
                    <Button onClick={() => onClose(false)} color='primary'>
                        Cancel
                    </Button>
                    <Button onClick={this.handleCreate} color='primary' autoFocus>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

class MainMenuButton extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            authorizationState: AppStore.getAuthorizationState(),
            anchorEl: null,
            openPasscode: false,
            openCreateGroup: false,
            isSmallWidth: AppStore.isSmallWidth
        };
    }

    componentDidMount() {
        AppStore.on('updateAuthorizationState', this.onUpdateAuthorizationState);
        AppStore.on('clientUpdatePageWidth', this.onClientUpdatePageWidth);
    }

    componentWillUnmount() {
        AppStore.off('updateAuthorizationState', this.onUpdateAuthorizationState);
        AppStore.off('clientUpdatePageWidth', this.onClientUpdatePageWidth);
    }

    onClientUpdatePageWidth = update => {
        const { isSmallWidth } = update;

        this.setState({ isSmallWidth });
    };

    onUpdateAuthorizationState = update => {
        this.setState({ authorizationState: update.authorization_state });
    };

    handleMenuOpen = event => {
        const { authorizationState } = this.state;
        if (!isAuthorizationReady(authorizationState)) return;

        this.setState({ anchorEl: event.currentTarget });
    };

    handleMenuClose = () => {
        this.setState({ anchorEl: null });
    };

    handleCheckUpdates = async () => {
        this.handleMenuClose();

        //await update();
    };

    handleNewChannel = event => {
        this.handleMenuClose();

        TdLibController.clientUpdate({
            '@type': 'clientUpdateNewChannel',
            open: true
        });
    };

    handleNewGroup = event => {
        this.handleMenuClose();
        
        TdLibController.clientUpdate({
            '@type': 'clientUpdateNewGroup',
            open: true
        });
    };

    handleNewSuperGroup = event => {
        this.handleMenuClose();

        this.setState({ openCreateGroup: true });
    };

    handleCreateSuperGroupContinue = result => {
        this.setState({ openCreateGroup: false });

        if (!result) return;

        showMessage('Create supergroup successfully.', this.props);
    };

    handlePasscode = event => {
        this.handleMenuClose();

        this.setState({ openPasscode: true });
    };

    handlePasscodeContinue = result => {
        this.setState({ openPasscode: false });

        if (!result) return;

        showMessage('Your local passcode was set successfully.', this.props);
    };

    handleContacts = event => {
        this.handleMenuClose();

        TdLibController.clientUpdate({
            '@type': 'clientUpdateContacts',
            open: true
        });
    };

    handleArchived = event => {
        this.handleMenuClose();

        openArchive();
    };

    handleSaved = async event => {
        this.handleMenuClose();

        let chat = CacheStore.cache ? CacheStore.cache.meChat : null;
        if (!chat) {
            chat = await TdLibController.send({
                '@type': 'createPrivateChat',
                user_id: UserStore.getMyId(),
                force: false
            });
        }

        if (!chat) return;

        openChat(chat.id);
    };

    handleSettings = async event => {
        this.handleMenuClose();

        let chat = CacheStore.cache ? CacheStore.cache.meChat : null;
        if (!chat) {
            chat = await TdLibController.send({
                '@type': 'createPrivateChat',
                user_id: UserStore.getMyId(),
                force: false
            });
        }

        if (!chat) return;

        TdLibController.clientUpdate({
            '@type': 'clientUpdateSettings',
            open: true,
            chatId: chat.id
        });
    };

    handleHelp = event => {
        this.handleMenuClose();
    };

    handleSearch = () => {
        this.handleMenuClose();

        searchChat(0);
    };

    render() {
        const { t, timeout, popup, showClose, onClose } = this.props;
        const { anchorEl, authorizationState, openPasscode, openCreateGroup, isSmallWidth } = this.state;

        const mainMenuControl =
            !showClose && isAuthorizationReady(authorizationState) ? (
                <Menu
                    id='main-menu'
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={this.handleMenuClose}
                    getContentAnchorEl={null}
                    disableAutoFocusItem
                    disableRestoreFocus={true}
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'left'
                    }}>
                    <MenuItem onClick={this.handlePasscode}>
                        <ListItemIcon>
                            <GroupIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('Set Local Password')} />
                    </MenuItem>
                    <MenuItem onClick={this.handleNewChannel}>
                        <ListItemIcon>
                            <ChannelIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('NewChannel')} />
                    </MenuItem>
                    <MenuItem onClick={this.handleNewGroup}>
                        <ListItemIcon>
                            <GroupIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('NewGroup')} />
                    </MenuItem>
                    <MenuItem onClick={this.handleNewSuperGroup}>
                        <ListItemIcon>
                            <GroupIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('New Supergroup')} />
                    </MenuItem>
                    { isSmallWidth && (
                        <MenuItem onClick={this.handleSearch}>
                            <ListItemIcon>
                                <SearchIcon />
                            </ListItemIcon>
                            <ListItemText primary={t('Search')} />
                        </MenuItem>
                    )}
                    <MenuItem onClick={this.handleContacts}>
                        <ListItemIcon>
                            <UserIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('Contacts')} />
                    </MenuItem>
                    <MenuItem onClick={this.handleArchived}>
                        <ListItemIcon>
                            <ArchiveIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('Archived')} />
                    </MenuItem>
                    <MenuItem onClick={this.handleSaved}>
                        <ListItemIcon>
                            <SavedIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('Saved')} />
                    </MenuItem>
                    <MenuItem onClick={this.handleSettings}>
                        <ListItemIcon>
                            <SettingsIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('Settings')} />
                    </MenuItem>
                    <MenuItem onClick={this.handleHelp}>
                        <ListItemIcon>
                            <HelpIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('SettingsHelp')} />
                    </MenuItem>
                </Menu>
            ) : null;

        const closeIcon = popup
            ? <CloseIcon/>
            : <ArrowBackIcon/>;

        return (
            <>
                <IconButton
                    aria-owns={anchorEl ? 'simple-menu' : null}
                    aria-haspopup='true'
                    className='header-left-button main-menu-button'
                    aria-label='Menu'
                    onClick={showClose ? onClose : this.handleMenuOpen}>
                    { timeout
                        ? (<SpeedDialIcon open={showClose} openIcon={<ArrowBackIcon />} icon={<MenuIcon />} />)
                        : (<>{showClose ? closeIcon : <MenuIcon />}</>)
                    }

                </IconButton>
                {mainMenuControl}
                <SetLocalPasscodeDialog open={openPasscode} onClose={this.handlePasscodeContinue} />
                <CreateSupergroupDialog open={openCreateGroup} onClose={this.handleCreateSuperGroupContinue} />
            </>
        );
    }
}

const enhance = compose(
    withTranslation(),
    withSnackbar
);

export default enhance(MainMenuButton);
