import { Schema, model, Types } from "mongoose";

interface ITenantApiKey {
    client_id: Types.ObjectId;
    hashedKey: string;
    label: string;
    active: boolean;
    lastUsedAt?: Date;
}

const TenantApiKeySchema = new Schema<ITenantApiKey>(
    {
        client_id: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
        hashedKey: { type: String, required: true, unique: true, index: true },
        label: { type: String, default: 'default' },
        active: { type: Boolean, default: true },
        lastUsedAt: { type: Date },
    },
    { timestamps: true }
);

export const TenantApiKeyModel = model<ITenantApiKey>('TenantApiKey', TenantApiKeySchema);
