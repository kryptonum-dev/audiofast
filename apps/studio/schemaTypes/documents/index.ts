import { faq } from './collections/faq';
import { footer } from './footer';
import { homePage } from './singletons/home-page';
import { navbar } from './singletons/navbar';
import { page } from './collections/page';
import { settings } from './singletons/settings';

export const singletons = [homePage, settings, footer, navbar];

export const collection = [page, faq];

export const documents = [...collection, ...singletons];
