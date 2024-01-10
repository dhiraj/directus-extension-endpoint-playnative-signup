import {Accountability} from '@directus/shared/types';
import {Query} from '@directus/shared/types';
import {SchemaOverview} from '@directus/shared/types';

// This export is necessary, because we're using "isolatedModules": true in tsconfig.json
export {};

declare global {
	namespace Express {
		export interface Request {
			token: string | null;
			collection: string;
			sanitizedQuery: Query;
			schema: SchemaOverview;

			accountability?: Accountability;
			singleton?: boolean;
		}
	}
}
