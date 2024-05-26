// Import the Firebase Functions module
const functions = require("firebase-functions");
// Import the Firebase Admin SDK
const admin = require("firebase-admin");
// Destructure the logger from functions
const {logger} = functions;

/**
 * This function is responsible for creating a new message in a chat in the Firestore database.
 * It expects an object with `userId`, `text`, `senderId`, and `chatId` properties in the `data` parameter.
 * If the `text`, `senderId`, or `userId` is missing, it throws an error.
 * If the message is successfully created, it returns an object with a status message, the ID of the chat, and the ID of the new message.
 * @param {Object} data - The data for the new message.
 * @param {Object} context - The context of the function call.
 * @returns {Object} - The status of the operation, the ID of the chat, and the ID of the new message.
 * @throws {functions.https.HttpsError} - If required fields are missing or an error occurs while adding the message.
 */
const postMessage = functions.https.onCall(async (data, context) => {
  try {
    logger.log("Receiving message data data for POST", data);
    // Destructure the userId, message text, senderId, and chatId from the data object
    const {userId, text, senderId, chatId} = data;
    // Check if the required fields are present in the data object
    if (!text || !senderId || !userId) {
      logger.log("Required fields are missing");
      // Throw an HTTP error for missing fields
      throw new functions.https.HttpsError(
          "invalid-argument",
          "Required fields (text or ID's for sender or receiver) are missing",
      );
    }
    // Check to see if the message that being sent, belongs to a specific chat room (baed on chatId)
    let newChatId = chatId;
    if (!newChatId) {
      newChatId = admin
          .firestore()
          .collection("users")
          .doc(userId)
          .collection("chats")
          .doc()
          .id;
    }
    // Create a new message object with the data from the data object
    const messageData = {
      senderId,
      text,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };
    // Add the message data to a specific chat collection that's within the Firestore database
    // My data model of the Firestore database for message reception is: users->[userId]->chats->[chatId]->messages->{sender,text,timestamp}
    const messageRef = await admin
        .firestore()
        .collection("users")
        .doc(userId)
        .collection("chats")
        .doc(newChatId.toString())
        .collection("messages")
        .add(messageData);
    // Return a success message after successfully adding message data to database
    return {status: "new message", chatId: newChatId, messageId: messageRef.id};
  } catch (error) {
    logger.log("Error adding message: ", error);
    // Throw an HTTP error with status "unknown" if an error occurs
    throw new functions.https.HttpsError(
        "unknown",
        "An error occurred while adding the message",
        error.message,
    );
  }
});

/**
 * This function is responsible for retrieving all messages from a specific chat of a specific user from the Firestore database.
 * It expects a `userId` and `chatId` in the `req.query`.
 * If either of these properties is missing, it throws an error.
 * If the messages are successfully retrieved, it returns the messages data.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Object} - The status of the operation and the retrieved messages data.
 * @throws {functions.https.HttpsError} - If required fields are missing or an error occurs while retrieving the messages.
 */
const getChat = functions.https.onRequest(async (req, res) => {
  try {
    logger.log("Receiving data of a specific user's chat", req);
    // Destructure the userId and chatId from the query object
    const userId = req.query.userId;
    const chatId = req.query.chatId;
    // Check if the required fields are present in the query object
    if (!userId || !chatId) {
      logger.log("Required fields are missing");
      // Throw an HTTP error with status "required" if required fields are missing
      throw new functions.https.HttpsError(
          "invalid-argument",
          "Required fields (ID's for user and chat) are missing",
      );
    }
    // Get the messages of a specific chat from the Firestore database
    const chatMessagesSnapshot = await admin
        .firestore()
        .collection("users")
        .doc(userId)
        .collection("chats")
        .doc(chatId.toString())
        .collection("messages")
        .get();
    const messages = chatMessagesSnapshot.docs.map((doc) => doc.data());
    // Return a success message after successfully retrieving messages data from database
    return res.status(200).json({status: "successfully got chat messages", messages: messages});
  } catch (error) {
    logger.error("Error fetching messages:", error);
    throw new functions.https.HttpsError(
        "unknown",
        "An error occurred while get a specific chat",
        error.message,
    );
  }
});

/**
 * This function is responsible for deleting all messages from a specific chat of a specific user from the Firestore database.
 * It expects a `userId` and `chatId` in the `req.query`.
 * If either of these properties is missing, it throws an error.
 * If the messages are successfully deleted, it returns a status message.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Object} - The status of the operation.
 * @throws {functions.https.HttpsError} - If required fields are missing or an error occurs while deleting the messages.
 */
const deleteChat = functions.https.onRequest(async (req, res) => {
  try {
    logger.log("Receiving data to delete messages", req);
    // Destructure the userId and chatId from the query object
    const userId = req.query.userId;
    const chatId = req.query.chatId;
    // Check if the required fields are present in the query object
    if (!userId || !chatId) {
      logger.log("Required fields are missing");
      // Throw an HTTP error with status "required" if required fields are missing
      throw new functions.https.HttpsError(
          "invalid-argument",
          "Required fields (ID's for user and chat) are missing",
      );
    }
    // Delete all messages from the specified chat of the specified user
    const chatMessagesSnapshot = await admin
        .firestore()
        .collection("users")
        .doc(userId)
        .collection("chats")
        .doc(chatId.toString())
        .collection("messages")
        .get();

    const batch = admin.firestore().batch();
    chatMessagesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    // Return a success message after successfully deleting messages data from database
    return res.status(200).json({status: "successfully deleted chat messages"});
  } catch (error) {
    logger.error("Error fetching messages:", error);
    // Return an error message if an error occurs while deleting messages data from database
    throw new functions.https.HttpsError(
        "unknown",
        "An error occurred while deleted the messages",
        error.message,
    );
  }
});

module.exports = {postMessage, getChat, deleteChat};