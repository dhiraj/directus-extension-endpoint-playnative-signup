import {defineEndpoint} from "@directus/extensions-sdk";
import {google} from "googleapis";
import { isEmpty } from 'lodash-es';
import jwt from 'jsonwebtoken';
import {nanoid} from 'nanoid';
import ms from 'ms';

export default defineEndpoint({
	id: 'playnative',
	handler: (router, context) => {
		const { services, getSchema, env } = context;
		const { UsersService, ItemsService } = services;

		const oAuth2Client = new google.auth.OAuth2(env.AUTH_GOOGLE_CLIENT_ID, env.AUTH_GOOGLE_CLIENT_SECRET)

		router.post('/callback', async (req, res) => {
			const schema = await getSchema();
			const usersService = new UsersService({ schema});
			const sessionsService = new ItemsService('directus_sessions',{ schema });
			if(!req.body.code){
				res.json({"error":"code is required"});
				return;
			}
			let tokenResponse;
			try {
				 tokenResponse =  await oAuth2Client.getToken(req.body.code);
				if (!tokenResponse.tokens){
					res.status(400).json({error:"Could not fetch tokens for provided auth code"}).end();
					return;
				}
				 oAuth2Client.setCredentials(tokenResponse.tokens);
				google.options({
					auth: oAuth2Client
				});
			}
			catch (e) {
				res.status(400).json({error:"Exception:Could not fetch tokens for provided auth code"}).end();
				return;
			}
			let player;
			try {
				player = await google.games("v1").players.get({"playerId":"me"});
			}
			catch (e) {
				res.status(400).json({error:"Exception:Could not get player from play games service for this auth code"}).end();
				return;
			}
			if (isEmpty(player.data.playerId)){
				res.status(400).json({error:"Could not get playerId from play games service for this auth code"}).end();
				return;
			}
			const userEmail = `${player.data.playerId}@noemail.com`;
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
				res.status(500).json({error:"Exception:Could not access / create user for this AuthCode"}).end();
				return;
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
				res.json( {
					access_token,
					refresh_token,
					expires: ms(env.ACCESS_TOKEN_TTL)
				});
			}
			catch (e) {
				res.status(500).json({error:"Exception:Could not create / sign access tokens for this Auth Code"}).end();
				return;
			}
		});
	},
});
