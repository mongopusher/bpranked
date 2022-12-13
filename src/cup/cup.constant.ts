import {CupMode} from "@webserver/cup/cup-mode.enum";

export const CUP = {
    [CupMode.One]: '1 vs 1',
    [CupMode.Two]: '2 vs 2',
    [CupMode.Three]: '3 vs 3',
}

export const CUPS = Object.values(CUP);