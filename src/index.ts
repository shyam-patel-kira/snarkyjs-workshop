import {
  Field,
  PrivateKey,
  PublicKey,
  SmartContract,
  state,
  State,
  method,
  Mina,
  isReady,
  shutdown,
  UInt64,
  Party,
} from "snarkyjs";

class Assignment extends SmartContract {
  @state(Field) x: State<Field>;
  @state(Field) y: State<Field>;
  @state(Field) z: State<Field>;

  constructor(
    initialBalance: UInt64,
    address: PublicKey,
    x: Field,
    y: Field,
    z: Field
  ) {
    super(address);

    this.balance.addInPlace(initialBalance);

    this.x = State.init(x);
    this.y = State.init(y);
    this.z = State.init(z);
  }

  @method async update(i: Field) {
    const x = await this.x.get();
    const y = await this.y.get();
    const z = await this.z.get();

    this.x.set(x.mul(i));
    this.y.set(y.mul(i.mul(2)));
    this.z.set(z.mul(i.mul(3)));
  }
}

export async function run() {
  await isReady;

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const account1 = Local.testAccounts[0].privateKey;
  const account2 = Local.testAccounts[1].privateKey;

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  let snappInstance: Assignment;

  const initX = new Field(7);
  const initY = new Field(8);
  const initZ = new Field(9);

  // Deploys the snapp
  await Mina.transaction(account1, async () => {
    // account2 sends 1000000000 to the new snapp account
    const amount = UInt64.fromNumber(1000000000);
    const p = await Party.createSigned(account2);
    p.balance.subInPlace(amount);

    snappInstance = new Assignment(
      amount,
      snappPubkey,
      initX,
      initY,
      initZ
    );
  })
    .send()
    .wait();

  // Update the snapp
  await Mina.transaction(account1, async () => {
    // x = 7 * 2 = 14
    // y = 8 * 2 * 2 = 32
    // z = 9 * 2 * 3 = 54
    await snappInstance.update(new Field(2));
  })
    .send()
    .wait();

  const intermediateAcc = await Mina.getAccount(snappPubkey);

  console.log("Updating Values...");
  console.log(
    "Intermediate Values : ",
    [
      intermediateAcc.snapp.appState[0].toString(),
      intermediateAcc.snapp.appState[1].toString(),
      intermediateAcc.snapp.appState[2].toString(),
    ].join(", ")
  );

  // Update the snapp again
  await Mina.transaction(account1, async () => {
    // x = 14 * 1 = 14
    // y = 32 * 2 = 64
    // z = 54 * 3 = 162
    await snappInstance.update(new Field(1));
  })
    .send()
    .wait();

  const finalAcc = await Mina.getAccount(snappPubkey);

  console.log(
    "Final state values : ",
    [
      finalAcc.snapp.appState[0].toString(),
      finalAcc.snapp.appState[1].toString(),
      finalAcc.snapp.appState[2].toString(),
    ].join(", ")
  );
}

run();
shutdown();