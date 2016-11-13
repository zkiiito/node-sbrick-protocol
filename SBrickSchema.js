module.exports = {
    '$schema': 'http://json-schema.org/draft-04/schema#',
    'type': 'object',
    'properties': {
        'uuid': {
            'type': 'string',
            'minLength': 12,
            'maxLength': 12
        },
        'password': {
            'type': 'string'
        },
        'streamUrl': {
            'type': 'string'
        },
        'channels': {
            'type': 'array',
            'minItems': 4,
            'maxItems': 4,
            'items': {
                'type': 'object',
                'properties': {
                    'channelId': {
                        'type': 'integer',
                        'maximum': 3,
                        'minimum': 0,
                    },
                    'min': {
                        'type': 'integer',
                        'maximum': 255,
                        'minimum': -255,
                    },
                    'max': {
                        'type': 'integer',
                        'maximum': 255,
                        'minimum': -255,
                    },
                    'keyInc': {
                        'type': 'integer',
                        'maximum': 255,
                        'minimum': 1,
                    },
                    'keyDec': {
                        'type': 'integer',
                        'maximum': 255,
                        'minimum': 1,
                    }
                },
                'required': [
                    'channelId',
                    'min',
                    'max',
                ]
            }
        }
    },
    'required': [
        'uuid',
        'channels'
    ]
};