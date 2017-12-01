// tslint:disable:no-any

import { none, Option, some, Some } from "fp-ts/lib/Option";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";

import { IService, toAuthorizedCIDRs } from "../../../models/service";

import { toNonEmptyString } from "../../../utils/strings";

import { Set } from "json-set-map";
import { AzureUserAttributesMiddleware } from "../azure_user_attributes";

// DANGEROUS, only use in tests
function _getO<T>(o: Option<T>): T {
  return (o as Some<T>).value;
}

interface IHeaders {
  readonly [key: string]: string | undefined;
}

function lookup(h: IHeaders): (k: string) => string | undefined {
  return (k: string) => h[k];
}

const aService: IService = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: new Set([]),
  departmentName: _getO(toNonEmptyString("MyDept")),
  organizationName: _getO(toNonEmptyString("MyService")),
  serviceId: _getO(toNonEmptyString("serviceId")),
  serviceName: _getO(toNonEmptyString("MyService"))
};

describe("AzureUserAttributesMiddleware", () => {
  it("should fail on empty user email", async () => {
    const serviceModel = jest.fn();

    const headers: IHeaders = {
      "x-user-email": ""
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesMiddleware(serviceModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledTimes(1);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-email");
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail on invalid user email", async () => {
    const serviceModel = jest.fn();

    const headers: IHeaders = {
      "x-user-email": "xyz"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesMiddleware(serviceModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledTimes(1);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-email");
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail on invalid key", async () => {
    const serviceModel = {
      findOneByServiceId: jest.fn()
    };
    const headers: IHeaders = {
      "x-subscription-id": undefined,
      "x-user-email": "test@example.com"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesMiddleware(serviceModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should proceed if the user service does not exist", async () => {
    const serviceModel = {
      findOneByServiceId: jest.fn(() => Promise.resolve(right(none)))
    };

    const headers: IHeaders = {
      "x-subscription-id": "MySubscriptionId",
      "x-user-email": "test@example.com"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesMiddleware(serviceModel as any);

    const result = await middleware(mockRequest as any);

    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(serviceModel.findOneByServiceId).toHaveBeenCalledWith(
      headers["x-subscription-id"]
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.kind).toEqual("IAzureUserAttributes");
    }
  });

  it("should fetch and return the user service from the custom attributes", async () => {
    const serviceModel = {
      findOneByServiceId: jest.fn(() => Promise.resolve(right(some(aService))))
    };

    const headers: IHeaders = {
      "x-subscription-id": "MySubscriptionId",
      "x-user-email": "test@example.com"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesMiddleware(serviceModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(serviceModel.findOneByServiceId).toHaveBeenCalledWith(
      headers["x-subscription-id"]
    );
    expect(isRight(result));
    if (isRight(result)) {
      const attributes = result.value;
      expect(attributes.service).toEqual(
        some({
          ...aService,
          authorizedRecipients: new Set()
        })
      );
    }
  });

  it("should fail in case of error when fetching the user service", async () => {
    const serviceModel = {
      findOneByServiceId: jest.fn(() => Promise.resolve(left("error")))
    };

    const headers: IHeaders = {
      "x-subscription-id": "MySubscriptionId",
      "x-user-email": "test@example.com"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesMiddleware(serviceModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(serviceModel.findOneByServiceId).toHaveBeenCalledWith(
      headers["x-subscription-id"]
    );
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value.kind).toEqual("IResponseErrorQuery");
    }
  });
});
