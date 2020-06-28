/*
 *  Copyright (c) 2018-present, Evgeny Nadymov
 *
 * This source code is licensed under the GPL v.3.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import withStyles from '@material-ui/core/styles/withStyles';
import { withTranslation } from 'react-i18next';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import FormControl from '@material-ui/core/FormControl';
import TdLibController from '../../Controllers/TdLibController';
import './AuthForm.css';
import AuthErrorDialog from './AuthErrorDialog';
import { compose } from '../../Utils/HOC';

const styles = {
    button: {
        margin: '16px 0 0 0'
    }
};

class LocalPassCodeControl extends React.Component {
    state = {
        error: null,
        loading: false
    };

    handleChange = event => {
        this.enteredPassword = event.target.value;
    };

    handleKeyPress = event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.handleDone();
        }
    };

    handleDone = async () => {
        await TdLibController.send({
            '@type': 'checkDatabaseEncryptionKey',
            encryption_key: btoa(this.enteredPassword)
        })
            .then(result => {})
            .catch(error => {
                this.setState({ error: { string: error.message } });
            });
    };

    handleLogout = async () => {
        await TdLibController.send({
            '@type': 'destroy'
        }).then(result => {
            window.location.reload();
        });
    };

    render() {
        const { classes, t } = this.props;
        const { error } = this.state;

        let errorString = '';
        if (error) {
            const { string } = error;
            errorString = string;
        }

        return (
            <div className='authorization-form'>
                <div className='authorization-form-content'>
                    <FormControl fullWidth>
                        <div className='authorization-header'>
                            <span className='authorization-header-content'>Please enter your local Passcode.</span>
                        </div>
                        <TextField
                            id='passcode'
                            type='password'
                            classes={{ root: 'auth-input' }}
                            variant='outlined'
                            color='primary'
                            label={t('Local Passcode')}
                            error={Boolean(errorString)}
                            helperText={errorString}
                            fullWidth
                            autoFocus
                            autoComplete='off'
                            onChange={this.handleChange}
                            onKeyPress={this.handleKeyPress}
                            defaultValue=''
                        />
                        <div className='sign-in-actions'>
                            <Button fullWidth color='primary' className={classes.button} onClick={this.handleDone}>
                                {t('Next')}
                            </Button>
                            <Button fullWidth color='primary' className={classes.button} onClick={this.handleLogout}>
                                {t('Logout')}
                            </Button>
                        </div>
                    </FormControl>
                </div>
                <AuthErrorDialog />
            </div>
        );
    }
}

LocalPassCodeControl.propTypes = {};

const enhance = compose(
    withTranslation(),
    withStyles(styles)
);

export default enhance(LocalPassCodeControl);
