import { SMTPServer as SMTPServerBase } from "smtp-server";
import { createWriteStream } from "fs";
import { tmpdir } from "os";
import path from "path";

import { jobDistributeMail } from "./delivery.js";
import { authorise } from "./auth.js";

const temporaryEmailFile = (id) => path.join(tmpdir(), `email-${id}.eml`);

export class SMTPServer extends SMTPServerBase {
  constructor(options) {
    super({
      ...options,
      banner: "github:eithan1231/authenticated-smtp-server",
      authMethods: ["LOGIN"],
      allowInsecureAuth: true,
      authOptional: false,
    });
  }

  /**
   * By default any client connection is allowed. If you want to check the
   * remoteAddress or clientHostname before any other command, you can set a
   * handler for it with onConnect
   * @param session includes the remoteAddress and clientHostname values
   * @param cb is the function to run after validation. If you return an error
   *   object, the connection is rejected, otherwise it is accepted
   */
  onConnect(session, cb) {
    cb();
  }

  /**
   * Authentication calls can be handled with onAuth handler
   * @param auth is an authentication object
   *   method: indicates the authentication method used, ‘PLAIN’, ‘LOGIN’ or ‘XOAUTH2’
   *   username: is the username of the user
   *   password: is the password if LOGIN or PLAIN was used
   *   accessToken: is the OAuth2 bearer access token if ‘XOAUTH2’ was used as the authentication method
   *   validatePassword: is a function for validating CRAM-MD5 challenge responses. Takes the password of the user as an argument and returns true if the response matches the password
   * @param session includes information about the session like remoteAddress for the remote IP, see details here
   * @param cb is the function to run once the user is authenticated. Takes 2 arguments: (error, response)
   *   error: is an error to return if authentication failed. If you want to set custom error code, set responseCode to the error object
   *   response: is an object with the authentication results
   *     user: can be any value - if this is set then the user is considered logged in and this value is used later with the session data to identify the user. If this value is empty, then the authentication is considered failed
   *     data: is an object to return if XOAUTH2 authentication failed (do not set the error object in this case). This value is serialized to JSON and base64 encoded automatically, so you can just return the object
   */
  onAuth(auth, session, cb) {
    try {
      if (auth.method !== "LOGIN") {
        return cb(new Error("prohibited method"));
      }

      // Authorized state. On failure, error is thrown.
      const authorized = authorise(auth.username, auth.password);

      cb(null, { user: authorized });
    } catch (err) {
      console.error(err);
      cb(err);
    }
  }

  /**
   * handles mail from event
   * @param address is an address object with the provided email address from MAIL FROM: command
   * @param session includes the envelope object and user data if logged in, see details here
   * @param callback is the function to run after validation. If you return an error object, the address is rejected, otherwise it is accepted
   */
  onMailFrom(address, session, cb) {
    if (address.address === session.user.address) {
      return cb();
    }

    cb(new Error("Bad Address"));
  }

  /**
   * Handles on recipient event.
   * @param address is an address object with the provided email address from RCPT TO: command
   * @param session includes the envelope object and user data if logged in, see details here
   * @param callback is the function to run after validation. If you return an error object, the address is rejected, otherwise it is accepted
   */
  onRcptTo(address, session, cb) {
    cb();
  }

  /**
   * You can get the stream for the incoming message with onData handler
   * @param stream is a readable stream for the incoming message
   * @param session includes the envelope object and user data if logged in, see details here
   * @param callback is the on to run once the stream is ended and you have processed the outcome. If you return an error object, the message is rejected, otherwise it is accepted
   */
  onData(stream, session, cb) {
    if (stream.sizeExceeded) {
      const err = new Error("message too big");
      err.responseCode = 552;
      return cb(err);
    }

    // generate temporary email file
    const path = temporaryEmailFile(session.id);

    // writing email to file
    const writeStream = createWriteStream(path);
    stream.pipe(writeStream);

    // 'end' event
    stream.on("end", () => {
      jobDistributeMail({
        id: session.id,
        authenticatedUser: session.user,
        envelope: session.envelope,
        mailPath: path,
      });

      cb();
    });
  }
}
