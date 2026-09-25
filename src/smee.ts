import SmeeClient from "smee-client";
import {AddressInfo} from "node:net";

export function createAndStartSmeeClient(info: AddressInfo): SmeeClient | undefined {
    const smeeUrl = process.env.SMEE_URL;
    if (!smeeUrl) {
        console.log("SMEE_URL is unset; GitHub deliveries will not reach this process");
        return;
    }

    const smee = new SmeeClient({
        source: smeeUrl,
        target: `http://127.0.0.1:${info.port}/webhooks/github`,
    });

    void smee.start().then(
        () => {
            console.log(`Forwarding GitHub webhooks from ${smeeUrl}`);
        },
        (error: unknown) => {
            console.error("Failed to start smee-client", error);
        },
    );

    return smee;
}
