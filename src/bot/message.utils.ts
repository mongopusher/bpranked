export const getGreeting = (name: string): string => {
    const greetings = [
        `Hi ${name}! Was geht ab?`,
        `Óla ${name}! Willkommen zurück!`,
        `Grias di ${name}, altes Scheißhaus!`,
        `Wazzuuup ${name}!?`,
    ];

    const random = Math.floor(Math.random() * greetings.length);
    return greetings[random];
}

export const getFarewell = (name: string): string => {
    const farewells = [
        `Machs gut ${name}! Bis bald.`,
        `Hau rein ${name}!`,
        `Digger, du gehst schon!?? Komm schon ${name}, bleib doch noch ein bisschen.`,
    ];

    const random = Math.floor(Math.random() * farewells.length);
    return farewells[random];
}