module.exports = async () => {
  await global.__POSTGRES_CONTAINER__?.stop();
};
