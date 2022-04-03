import {
  Field,
  PrivateKey,
  PublicKey,
  SmartContract,
  state,
  State,
  method,
  UInt64,
  Mina,
  Party,
  isReady,
  shutdown,
} from 'snarkyjs';

class Assignment extends SmartContract {
  @state(Field) num1: State<Field>;
  @state(Field) num2: State<Field>;
  @state(Field) num3: State<Field>;

  constructor(
    initialBalance: UInt64,
    address: PublicKey,
    num1: Field,
    num2: Field,
    num3: Field
  ) {
    super(address);
    this.balance.addInPlace(initialBalance);
    this.num1 = State.init(num1);
    this.num2 = State.init(num2);
    this.num3 = State.init(num3);
  }

  @method async update(updated: Field) {
    const num1 = await this.num1.get();
    const num2 = await this.num2.get();
    const num3 = await this.num3.get();
    const num = new Field(20);

    num.assertEquals(updated);

    this.num1.set(num1.mul(updated.mul(2)));
    this.num2.set(num2.mul(updated.mul(3)));
    this.num3.set(num3.mul(updated.mul(5)));
  }
}

async function runSimpleApp() {
  await isReady;

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const account1 = Local.testAccounts[0].privateKey;
  const account2 = Local.testAccounts[1].privateKey;

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  let snappInstance: Assignment;
  const initSnappState1 = new Field(1);
  const initSnappState2 = new Field(2);
  const initSnappState3 = new Field(3);

  // Deploys the snapp
  await Mina.transaction(account1, async () => {
    // account2 sends 1000000000 to the new snapp account
    const amount = UInt64.fromNumber(1000000000);
    const p = await Party.createSigned(account2);
    p.balance.subInPlace(amount);

    snappInstance = new Assignment(
      amount,
      snappPubkey,
      initSnappState1,
      initSnappState2,
      initSnappState3
    );
  })
    .send()
    .wait();

  // Update the snapp
  await Mina.transaction(account1, async () => {
    // x = 1 * 20 * 2 = 40
    // y = 2 * 20 * 3 = 120
    // z = 3 * 20 * 5 = 300
    await snappInstance.update(new Field(20));
  })
    .send()
    .wait();

  await Mina.transaction(account1, async () => {
    // should fail, because the provided value is wrong.
    await snappInstance.update(new Field(109));
  })
    .send()
    .wait()
    .catch((e) => console.log('second update attempt failed'));

  const a = await Mina.getAccount(snappPubkey);

  console.log('final state value of num1', a.snapp.appState[0].toString());
  console.log('final state value of num2', a.snapp.appState[1].toString());
  console.log('final state value of num3', a.snapp.appState[2].toString());
}

runSimpleApp();

shutdown();
