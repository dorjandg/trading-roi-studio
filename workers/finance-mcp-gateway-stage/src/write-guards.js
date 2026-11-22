// Pure, side-effect-free guards for a future controlled-write implementation.
// No D1 connection, credentials, or production mutations.
export const ALLOWED_FIELDS = Object.freeze(["category","provider","description"]);

export function validateChange(snapshot, args) {
  if (!snapshot || !Number.isInteger(snapshot.revision) || !Array.isArray(snapshot.data?.transactions))
    return {ok:false,code:"INVALID_SNAPSHOT"};
  if (!args || typeof args.transaction_id !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(args.transaction_id) ||
      !Number.isInteger(args.expected_revision) ||
      !ALLOWED_FIELDS.includes(args.field) ||
      typeof args.expected_value !== "string" ||
      typeof args.new_value !== "string" ||
      !args.new_value.trim() || args.new_value.length > 300 ||
      args.new_value === args.expected_value)
    return {ok:false,code:"INVALID_ARGUMENTS"};
  if (args.expected_revision !== snapshot.revision)
    return {ok:false,code:"REVISION_CONFLICT"};
  const matches=snapshot.data.transactions.filter(t=>t.id===args.transaction_id);
  if(matches.length!==1)return {ok:false,code:"TRANSACTION_NOT_UNIQUE"};
  const before=matches[0][args.field]??"";
  if(typeof before!=="string"||before!==args.expected_value)
    return {ok:false,code:"VALUE_CONFLICT"};
  return {ok:true,transaction_id:args.transaction_id,field:args.field,before,after:args.new_value,revision:snapshot.revision};
}

export function applyChangeToCopy(snapshot, validated) {
  if(!validated?.ok)throw Error("Validation required");
  // A fresh copy ensures no changes to the input and preserves every unrelated field.
  const next=structuredClone(snapshot);
  const tx=next.data.transactions.find(t=>t.id===validated.transaction_id);
  if(!tx||tx[validated.field]!==validated.before||next.revision!==validated.revision)
    throw Error("Stale preview");
  tx[validated.field]=validated.after;
  next.revision++;
  return next;
}
