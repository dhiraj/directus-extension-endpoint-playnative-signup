# directus-extension-endpoint-playnative-signup
Allows an android play games services client to post an auth code to create a user in Directus and returns OAuth2 tokens for it. This is a directus.io endpoint extension that will allow you to potentially integrate with Google Play Games Services APIs from your backend, while also creating a backend user that can call APIs in Directus.

# Setup
1. You need a play store app that uses Google Play Games services
2. You need a cloud console app registered in the app's Play Console listing that has OAuth2 consent
3. You need a "web application" client registered in the same Google Cloud Console project

# Steps
1. Get your Android app to authenticate with Google Play Games Services.
2. With your signed-in GamesServicesClient, request for a Server Side Access code, passing in the **web client_id** using `requestServerSideAccess(getString(R.string.backend_google_auth_client_id),true)`
3. This will give you back a Task Result string with an `auth code`
4. Send this authcode in a POST request to your directus instance that has this extension installed at `/playnative/callback`
5. A user will get created using the play games services `playerId` and player details
6. AFAIK, there's no way to get an email out of this signup, so we make up an email address using `<playerId>@noemail.com`
7. The backend user's accesstoken and refresh token for the upadted / newly created user is returned in the same call. You should store this on your local client end to be able to make authenticated calls to the API from your app
 
# Status
This project is nascent and has almost no testing. It involves creating a user in your Directus instance and thus impacts security. I am not a security expert. I am probably the only person using this. I also have limited experience with Directus, so there might be several things wrong with this extension that I am completely unaware of. Use at your own risk, please do not blame me if something, *anything* goes wrong due to this extension.

I'm quite happy to receive suggestions, contributions, issues and discussion about this project, thank you!