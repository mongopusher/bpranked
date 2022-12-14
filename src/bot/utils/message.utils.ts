import {EMOJI} from "@webserver/bot/utils/emoji.constant";

export const getInitialGreeting = (name: string): string => {
    const greetings = [
        `Sei gegrüßt ${name}!\nErweise dich als würdig.`,
        `Willkommen ${name}!\nVerneige dich vor deinem neuen Gott!`,
        `Hallo ${name}!\nTritt ein und werde Teil einer neuen Weltordnung!`,
    ];

    const random = Math.floor(Math.random() * greetings.length);
    return greetings[random];
};

export const getGreeting = (name: string): string => {
    const greetings = [
        `Hi ${name}! Was geht ab?`,
        `Óla ${name}! Willkommen zurück!`,
        `Grias di ${name}, altes Scheißhaus!`,
        `Wazzuuup ${name}!?`,
    ];

    const random = Math.floor(Math.random() * greetings.length);
    return greetings[random];
};

export const getFarewell = (name: string): string => {
    const farewells = [
        `Machs gut ${name}! Bis bald.`,
        `Hau rein ${name}!`,
        `Digger, du gehst schon!?? Komm schon ${name}, bleib doch noch ein bisschen.`,
    ];

    const random = Math.floor(Math.random() * farewells.length);
    return farewells[random];
};

export const getCheers = (): string => {
    const cheers = [
        `Prost! ${EMOJI.CLINKING_BEER_MUGS}`,
        `Zum Wohle! ${EMOJI.CLINKING_BEER_MUGS}`,
        `Skål! ${EMOJI.CLINKING_BEER_MUGS}`,
        `Cheers! ${EMOJI.CLINKING_BEER_MUGS}`,
        `Salute! ${EMOJI.CLINKING_BEER_MUGS}`,
        `Kanpai! ${EMOJI.CLINKING_BEER_MUGS}`,
    ];

    const random = Math.floor(Math.random() * cheers.length);
    return cheers[random];
};

export const gib = (): string => {
    const strings = [
        `${EMOJI.BOAR}`,
        `${EMOJI.PEACH}`,
        `${EMOJI.AUBERGINE}`,
        `${EMOJI.PILE_OF_POO}`,
    ];

    const random = Math.floor(Math.random() * strings.length);
    return strings[random];
};
