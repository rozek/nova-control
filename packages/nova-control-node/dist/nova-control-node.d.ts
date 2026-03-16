export declare const BaudRate = 9600;

/**** buildDirectPacket — 5-byte direct servo control packet ****/
export declare function buildDirectPacket(State: ServoState): Uint8Array;

/**** HomePosition ****/
export declare const HomePosition: Readonly<ServoState>;

/**** NovaController ****/
export declare interface NovaController {
    home(): Promise<void>;
    shiftHeadTo(Degrees: number): Promise<void>;
    rollHeadTo(Degrees: number): Promise<void>;
    pitchHeadTo(Degrees: number): Promise<void>;
    liftHeadTo(Degrees: number): Promise<void>;
    rotateBodyTo(Degrees: number): Promise<void>;
    get State(): ServoState;
    set State(Update: ServoUpdate);
    sendServoState(): Promise<void>;
    destroy(): void;
}

/**** NovaOptions ****/
export declare interface NovaOptions {
    StepIntervalMs?: number;
}

/**** openNova — factory ****/
export declare function openNova(PortPath: string, Rate?: number, Options?: NovaOptions): Promise<NovaController>;

/**** SafeRange ****/
export declare const SafeRange: Readonly<Record<ServoKey, [number, number]>>;

/*******************************************************************************
 *                                                                              *
 *                             nova-control-node                                *
 *                                                                              *
 *******************************************************************************/
/**** ServoKey ****/
export declare type ServoKey = 's1' | 's2' | 's3' | 's4' | 's5';

/**** ServoSpeed — °/ms so that the full safe range takes exactly 1 second ****/
export declare const ServoSpeed: Readonly<Record<ServoKey, number>>;

/**** ServoState ****/
export declare type ServoState = {
    [K in ServoKey]: number;
};

/**** ServoUpdate ****/
export declare type ServoUpdate = Partial<ServoState>;

export { }
