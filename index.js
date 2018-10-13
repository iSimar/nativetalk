import React from 'react';
import { Modal, TouchableHighlight, StyleSheet, Text, View, AsyncStorage } from 'react-native';
import { GiftedChat } from 'react-native-gifted-chat';
import NavigationBar from 'react-native-navbar';
import firebase from 'firebase';
import { ifIphoneX } from 'react-native-iphone-x-helper';
import PropTypes from 'prop-types';

const chatroomIdStorageKey = 'native-talk-chat-room-id';
const firebaseConfig = {
	databaseURL: "https://nativetalk-2a338.firebaseio.com",
	projectId: "nativetalk-2a338",
};
const messageEndpoint = "https://us-central1-nativetalk-2a338.cloudfunctions.net/messages";

export default class NativeTalk extends React.Component {

	constructor(props) {
		super(props);
		const { greeting } = this.props;
		this.state = {
			modalVisible: false,
			messages: [],
			chatRoomId: null,
			ableToFetchMessages: false,
			joinedChatRoom: false,
			firstMessage: {
				text: greeting,
				name: 'Help Desk'
			}
		};
	}
	
	componentWillMount = async () => {
		const { firstMessage } = this.state;
		const chatRoomId = await AsyncStorage.getItem(chatroomIdStorageKey);
		this.setState({
			chatRoomId,
			ableToFetchMessages: chatRoomId ? true : false,
			messages: [
				{
					_id: Math.random().toString(36).substring(7),
					text: firstMessage.text,
					createdAt: new Date(),
					user: {
						_id: 2,
						name: firstMessage.name,
					},
				},
			]
		});
	}

	fetchMessages() {
		const { chatRoomId } = this.state;
		const { appId } = this.props;
		this.setState({
			ableToFetchMessages: false
		}, () => {
			if (chatRoomId) {
				fetch(`${messageEndpoint}?appId=${appId}&chatRoomId=${chatRoomId}`, {
					method: 'GET',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
					}
				})
				.then((response) => response.json())
				.then((res) => {
					if (Array.isArray(res)) {
						const oldMessages = res.map(message => {
							const ret = {
								_id: message.id,
								text: message.text,
								createdAt: new Date(message.createdAt),
								user: {
									_id: message.fromServiceProvider ? 2 : 1,
									name: message.name ? message.name : 'Help Desk'
								}
							};
							return ret;
						});
						this.setState(previousState => ({
							ableToFetchMessages: false,
							messages: GiftedChat.append(oldMessages, previousState.messages),
						}));
					}
				});
			}
		});
	}

	joinChatRoom(chatRoomId) {
		const { appId } = this.props;
		AsyncStorage.setItem(chatroomIdStorageKey, chatRoomId);
		this.setState({
			chatRoomId,
			joinedChatRoom: true,
		}, () => {
			if (!firebase.apps.length) {
				firebase.initializeApp(firebaseConfig);
			}
			firebase.database().ref(`apps/${appId}/chatrooms/${chatRoomId}`).on('value', function (snapshot) {
				const val = snapshot.val();
				if (val && val.lastMessage && val.lastMessage.id && val.lastMessage.text &&
						val.lastMessage.createdAt && val.lastMessage.fromServiceProvider && val.lastMessage.name){
					this.onSend({
						_id: val.lastMessage.id,
						text: val.lastMessage.text,
						createdAt: new Date(val.lastMessage.createdAt),
						user: {
							_id: 2,
							name: val.lastMessage.name
						}
					});
				}
			}.bind(this));
		});
	}
	

	setModalVisible(visible) {
		this.setState({modalVisible: visible});
	}

	onSend(messages = [], post = false) {
		this.setState(previousState => ({
			messages: GiftedChat.append(previousState.messages, messages),
		}));
		if (post && messages.length > 0 && messages[0].text) {
			const { text } = messages[0];
			const { chatRoomId, joinedChatRoom, firstMessage } = this.state;
			const { appId } = this.props;
			const body = {
				text,
				chatRoomId,
				appId
			};
			if (!joinedChatRoom) {
				body.firstMessage = firstMessage;
			}
			fetch(messageEndpoint, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body)
			})
			.then((response) => response.json())
			.then((res) => {
				if (res.chatRoomId && (!this.state.chatRoomId || res.chatRoomId !== this.state.chatRoomId || !joinedChatRoom)) {
					this.joinChatRoom(res.chatRoomId);
				}
			});
		}
	}

	render() {
		const { children } = this.props;
		const { modalVisible, messages, ableToFetchMessages } = this.state;
		return (
			<View style={{flex: 1}}>
				{children}
				<TouchableHighlight onPress={() => this.setModalVisible(true)}>
					<View style={styles.bubble}>
						<Text style={styles.bubbleText}>Help</Text>
					</View>
				</TouchableHighlight>
				<Modal animationType="slide"
						transparent={false}
						visible={modalVisible}>
					<View style={styles.chatContainer}>
						<NavigationBar 
							style={styles.navbar}
							title={{ title: 'Help Desk', style: styles.navbarTitle}}
							leftButton={{ title: 'Close', handler: () => this.setModalVisible(false) }}
							tintColor="#f8f8f8"
						/>
						<GiftedChat messages={messages}
									onSend={messages => this.onSend(messages, true)}
									user={{
										_id: 1,
									}}
									onLoadEarlier={this.fetchMessages.bind(this)}
									loadEarlier={ableToFetchMessages}
						/>
					</View>
        		</Modal>
			</View>
		);
	}
}

NativeTalk.defaultProps = {
	appId: null,
	greeting: 'Hello there! 😄\n\nLet us know if you need help with anything!'
};

NativeTalk.propTypes = {
	appId: PropTypes.string.isRequired,
	greeting: PropTypes.string
};

const styles = StyleSheet.create({
	container: {
		flex: 1
	},
	bubble: {
		position: 'absolute',
		right: -10,
		bottom: 120,
		backgroundColor: '#0273C3',
		justifyContent: 'center',
		alignItems: 'center',
		borderTopRightRadius: 10,
		borderTopLeftRadius: 10,
		padding: 12,
		transform: [{ rotate: '270deg'}]
	},
	bubbleText: {
		fontSize: 15,
		color: '#fff'
	},
	navbar: {
		paddingLeft: 10,
		...ifIphoneX({
			height: 65,
			paddingTop: 10
        })
	},
	navbarTitle: {
		fontFamily: 'Helvetica',
		...ifIphoneX({
			paddingTop: 12
        })
	},
	chatContainer: {
		flex: 1,
		...ifIphoneX({
            marginBottom: 20
        })
	}
});
