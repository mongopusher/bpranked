import {CupMode} from "@webserver/cup/cup-mode.enum";

export const CUP = {
    [CupMode.One]: '1 vs 1',
    [CupMode.Two]: '2 vs 2',
    [CupMode.Three]: '3 vs 3',
}

export const CUPS_REVERSED = {
    ['1 vs 1']: CupMode.One,
    ['2 vs 2']: CupMode.Two,
    ['3 vs 3']: CupMode.Three,
}

export const CUP_TEXTS = Object.values(CUP);
