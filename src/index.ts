import {defineEndpoint} from "@directus/extensions-sdk";
import {google} from "googleapis";
import { isEmpty } from 'lodash-es';
import jwt from 'jsonwebtoken';
import {nanoid} from 'nanoid';
import ms from 'ms';

export default defineEndpoint({
	id: 'playnative',
	handler: (router, context) => {
		const { services, database, getSchema, env, logger } = context;
		const { UsersService, ItemsService } = services;

		const oAuth2Client = new google.auth.OAuth2(env.AUTH_GOOGLE_CLIENT_ID, env.AUTH_GOOGLE_CLIENT_SECRET)

		router.post('/callback', async (req, res) => {
			const schema = await getSchema();
			const usersService = new UsersService({ schema});
			const sessionsService = new ItemsService('directus_sessions',{ schema });
			if(!req.body.code){
				return res.status(422).json({error:"code is required"});
			}
			let tokenResponse;
			try {
				 tokenResponse =  await oAuth2Client.getToken(req.body.code);
				if (!tokenResponse.tokens){
					return res.status(400).json({error:"Could not fetch tokens for provided auth code"}).end();
				}
				 oAuth2Client.setCredentials(tokenResponse.tokens);
				google.options({
					auth: oAuth2Client
				});
			}
			catch (e) {
				logger.error(e,"Error fetching token response")
				return res.status(400).json({error:"Exception:Could not fetch tokens for provided auth code"}).end();
			}
			let player;
			try {
				player = await google.games("v1").players.get({"playerId":"me"});
			}
			catch (e) {
				logger.error(e,"Error fetching player/me")
				return res.status(400).json({error:"Exception:Could not get player from play games service for this auth code"}).end();
			}
			// logger.info(player, "Fetched player/me")
			if (isEmpty(player.data.playerId)){
				return res.status(400).json({error:"Could not get playerId from play games service for this auth code"}).end();
			}
			const userEmail = `${player.data.playerId}@pgsnoemail.com`;
			let foundUser = await usersService.getUserByEmail(userEmail);
			try {
				if (!isEmpty(foundUser) && !isEmpty(tokenResponse.tokens.refresh_token)){
					await usersService.updateOne(foundUser.id,{
						auth_data: tokenResponse.tokens.refresh_token && JSON.stringify({ refreshToken: tokenResponse.tokens.refresh_token }),
					})
				}
				else {
					foundUser = await usersService.createOne({
						provider: "google",
						first_name: player.data.displayName,
						last_name: "",
						email: userEmail,
						external_identifier: player.data.playerId,
						role: env.AUTH_GOOGLE_DEFAULT_ROLE_ID,
						auth_data: tokenResponse.tokens.refresh_token && JSON.stringify({ refreshToken: tokenResponse.tokens.refresh_token }),
					});
				}
			}
			catch (e) {
				logger.error(e,`Error updating directus user, email=${userEmail}`)
				return res.status(500).json({error:`Exception:Could not access / create user for this AuthCode`}).end();
			}
			try{
				const access_token = jwt.sign({
					id: foundUser.id,
					role: env.AUTH_GOOGLE_DEFAULT_ROLE_ID,
					app_access:false,
					admin_access:false,
				}, env.SECRET, {
					expiresIn: env.ACCESS_TOKEN_TTL,
					issuer: 'directus',
				});
				const refresh_token = nanoid(64);
				const refreshTokenExpiration = new Date(Date.now() + ms(env.REFRESH_TOKEN_TTL));

				await sessionsService.createOne({
					token: refresh_token,
					user: foundUser.id,
					expires: refreshTokenExpiration
				});
				return res.json( {
					access_token,
					refresh_token,
					expires: ms(env.ACCESS_TOKEN_TTL)
				});
			}
			catch (e) {
				logger.error(e,"Error signing access token")
				return res.status(500).json({error:"Exception:Could not create / sign access tokens for this Auth Code"}).end();
			}
		});
	},
});
