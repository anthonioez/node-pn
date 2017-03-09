const debug = require("debug")("apn");

const parse = require("./credentials/parse")({
    parsePkcs12  : require("./credentials/parsePkcs12"),
    parsePemKey  : require("./credentials/parsePemKey"),
    parsePemCert : require("./credentials/parsePemCertificate"),
});

const prepareCredentials = require("./credentials/prepare")({
    load     : require("./credentials/load"),
    parse,
    validate : require("./credentials/validate"),
    logger   : debug
});

const config = require("./config")({
    debug,
    prepareCredentials
});

const tls = require("tls");

const framer = require("./protocol/framer");
const compressor = require("./protocol/compressor");

const protocol = {
    Serializer   : framer.Serializer,
    Deserializer : framer.Deserializer,
    Compressor   : compressor.Compressor,
    Decompressor : compressor.Decompressor,
    Connection   : require("./protocol/connection").Connection,
};

const Endpoint = require("./protocol/endpoint")({
    tls,
    protocol
});

const EndpointManager = require("./protocol/endpointManager")({
    Endpoint
});

const Connection = require("./connection")({
    config,
    EndpointManager
});

const Notification = require("./notification");

const Device = require("./device");

module.exports = {
    Connection,
    Notification,
    Device
};